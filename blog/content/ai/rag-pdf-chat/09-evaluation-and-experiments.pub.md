---
title: "[RAG 09] 실험과 평가 — 감이 아니라 숫자로 고르기"
date: 2026-09-08
category: "AI"
categories:
  - "AI"
  - "LLM"
tags:
  - "RAG"
  - "Evaluation"
  - "Observability"
  - "Redis"
  - "LLM as Judge"
summary: "컴포넌트를 맵으로 등록해 조합을 실험하는 구조, 사용자 평가를 확률로 되먹이는 밴딧 방식, 트레이싱, 그리고 골든셋과 LLM 심판을 이용한 오프라인 평가를 다룹니다."
---

여기까지 오면서 정답 없는 선택을 잔뜩 했습니다.

청크 크기 500자? 1000자? k는 2? 4? 모델은 작은 것? 큰 것? 메모리는 전체? 윈도우?

이걸 감으로 정하면 끝이 없습니다. 답변 몇 개를 읽어 보고 "이게 나은 것 같은데"라고 판단하는 것은
표본이 너무 적고, 무엇보다 **어제의 나와 오늘의 나가 다른 기준**을 씁니다.

`pdf-app`이 특히 잘한 부분이 이 문제를 **코드로 푼 것**입니다.

## 1. 컴포넌트를 맵으로 등록한다

`pdf-app`은 각 컴포넌트를 **이름 → 생성 함수**의 딕셔너리로 등록합니다.

```python
# app/chat/vector_stores/__init__.py
retriever_map = {
    "pinecone_1": partial(build_retriever, k=1),
    "pinecone_2": partial(build_retriever, k=2),
    "pinecone_3": partial(build_retriever, k=3),
}

# app/chat/llms/__init__.py
llm_map = {
    "gpt-4": partial(build_llm, model_name="gpt-4"),
    "gpt-3.5-turbo": partial(build_llm, model_name="gpt-3.5-turbo"),
}

# app/chat/memories/__init__.py
memory_map = {
    "sql_buffer_memory": build_memory,
    "sql_window_memory": window_buffer_memory_builder,
}
```

이제 조합은 3 × 2 × 2 = 12가지입니다. `build_chat`이 대화마다 하나를 뽑습니다.

```python
def build_chat(chat_args: ChatArgs):
    retriever_name, retriever = select_component("retriever", retriever_map, chat_args)
    llm_name, llm = select_component("llm", llm_map, chat_args)
    memory_name, memory = select_component("memory", memory_map, chat_args)

    set_conversation_components(
        conversation_id=chat_args.conversation_id,
        llm=llm_name, retriever=retriever_name, memory=memory_name,
    )
    ...
```

### 왜 선택을 대화에 저장하는가

`set_conversation_components`가 결정적입니다. 뽑은 조합을 **대화 레코드에 기록**해 두고,

```python
def select_component(component_type, component_map, chat_args):
    components = get_conversation_components(chat_args.conversation_id)
    previous_component = components[component_type]

    if previous_component:                      # 이미 정해진 대화면 그대로
        return previous_component, component_map[previous_component](chat_args)

    random_name = random_component_by_score(component_type, component_map)
    return random_name, component_map[random_name](chat_args)
```

**같은 대화에서는 계속 같은 조합**을 씁니다. 이게 없으면 메시지마다 모델이 바뀌어서
사용자가 "이 대화 좋았어요"라고 평가해도 **무엇이 좋았던 건지 알 수 없습니다.**
평가의 단위와 실험의 단위를 일치시키는, 작지만 중요한 설계입니다.

이 패턴은 다른 곳에도 그대로 쓸 수 있습니다. 프롬프트 A/B 테스트, 청킹 전략 비교 모두
"이름 → 빌더 맵 + 대화에 고정" 구조면 됩니다.

## 2. 사용자 평가를 확률로 되먹이기

사용자가 대화에 점수를 매기면(`POST /api/scores`) 그 점수가 **컴포넌트별로** 누적됩니다.

```python
def score_conversation(conversation_id, score, llm, retriever, memory) -> None:
    score = min(max(score, 0), 1)
    for component_type, name in zip(COMPONENT_TYPES, (llm, retriever, memory)):
        client.hincrbyfloat(_values_key(component_type), name, score)  # 점수 합계
        client.hincrby(_counts_key(component_type), name, 1)           # 평가 횟수
```

Redis 해시 두 개에 **합계와 횟수를 따로** 저장하고, 평균은 나중에 계산합니다.

그리고 다음 대화의 컴포넌트를 뽑을 때 이 평균을 확률로 씁니다.

```python
def random_component_by_score(component_type, component_map):
    avg_scores = {
        name: max(avg, 0.1)      # 최소 0.1을 깔아 탐색 여지를 남긴다
        for name, avg in _average_scores(component_type, component_map.keys()).items()
    }

    sum_scores = sum(avg_scores.values())
    random_val = random.uniform(0, sum_scores)
    cumulative = 0
    for name, score in avg_scores.items():
        cumulative += score
        if random_val <= cumulative:
            return name
```

**평균 점수에 비례한 가중 랜덤 선택**입니다. 좋은 평가를 받은 조합이 더 자주 뽑힙니다.
구조적으로는 **multi-armed bandit**에 가깝습니다.

`max(avg, 0.1)`이 핵심입니다. 평균이 0인 컴포넌트도 최소 0.1의 가중치를 받아
**아주 가끔은 다시 뽑힙니다.** 이게 없으면 초반에 운 나쁘게 낮은 점수를 받은 컴포넌트가
영원히 배제됩니다. 이걸 **탐색(exploration)** 이라고 하고,
좋은 것을 계속 쓰는 것을 **활용(exploitation)** 이라고 합니다. 둘의 균형이 밴딧 문제의 전부입니다.

평가 이력이 없는 컴포넌트에 기본값 1.0(최고점)을 주는 것도 같은 맥락입니다.
새로 추가한 조합이 **최소 한 번은 시도**되도록 보장합니다.

### 이 구조에서 실수하기 쉬운 두 가지

이 되먹임 루프는 **틀려도 에러가 나지 않습니다.** 그냥 조용히 동작하지 않을 뿐이죠.
`pdf-app`도 두 가지 문제를 겪었습니다.

**① 쓰는 키와 읽는 키가 어긋나는 것.**
예전 코드는 저장할 때 `llm_srore_values`(오타), 읽을 때 `llm_score_values`를 썼습니다.
점수는 꼬박꼬박 쌓였지만 **선택에는 전혀 반영되지 않았습니다.**
지금은 키를 함수로 만들어 한 곳에서 생성합니다.

```python
def _values_key(component_type: str) -> str:
    return f"{component_type}_score_values"

def _counts_key(component_type: str) -> str:
    return f"{component_type}_score_counts"
```

**문자열 키를 여기저기서 만들지 마세요.** 헬퍼 하나로 모으면 오타가 나도 양쪽이 같이 틀려서 동작합니다.

**② 정수 연산으로 실수 점수를 누적하는 것.**
Redis의 `hincrby`는 **정수만** 다룹니다. 0.75 같은 점수를 넣으면 오류가 나거나 0으로 절삭됩니다.
그래서 합계는 `hincrbyfloat`, 횟수는 `hincrby`로 나눠 씁니다.

> **평가 파이프라인은 조용히 고장 나는 종류의 코드입니다.**
> 점수를 몇 개 넣고 `get_scores()`가 기대한 값을 돌려주는지 확인하는 테스트를 꼭 하나 만들어 두세요.

### 점수는 어디서 오나

프론트에서 대화에 좋아요/싫어요를 누르면 됩니다.

```python
@bp.route("/", methods=["POST"])
@login_required
@load_model(Conversation, lambda r: r.args.get("conversation_id"))
def update_score(conversation):
    score = request.json.get("score")
    if not isinstance(score, (int, float)) or score < -1 or score > 1:
        raise BadRequest("Score must be a float between -1 and 1")

    score_conversation(conversation.id, score,
                       llm=conversation.llm,
                       retriever=conversation.retriever,
                       memory=conversation.memory)
    return {"message": "Score updated"}
```

**사용자 평가 버튼은 만들기 쉬운데 효과가 큽니다.** 데이터가 쌓이면
"어떤 조합이 실제로 나은가"를 처음으로 알게 됩니다.

다만 한계도 분명합니다. 표본이 적고, 사용자는 답이 틀려도 그럴듯하면 좋아요를 누릅니다.
그래서 오프라인 평가(5절)와 함께 써야 합니다.

## 3. 트레이싱 — 안 보이면 못 고친다

RAG는 중간 단계가 많습니다. 답변이 이상할 때 확인해야 할 것들입니다.

- 압축된 질문이 무엇이었나
- 어떤 청크가 검색됐나
- 최종 프롬프트가 어떻게 조립됐나
- 각 단계에서 토큰을 얼마나 썼고 얼마나 걸렸나

이걸 `print`로 쫓아다니는 것은 금방 한계가 옵니다. **트레이싱 도구**를 붙이세요.

`pdf-app`은 Langfuse를 쓰고, 붙이는 방법이 재미있습니다(`app/chat/chains/traceable.py`).

```python
class TraceableChain:
    def __call__(self, *args, **kwargs):
        trace = langfuse.trace(
            CreateTrace(id=self.metadata["conversation_id"], metadata=self.metadata)
        )
        callbacks = kwargs.get("callbacks", [])
        callbacks.append(trace.getNewHandler())
        kwargs["callbacks"] = callbacks
        return super().__call__(*args, **kwargs)
```

그리고 믹스인으로 섞습니다.

```python
class StreamingConversationalRetrievalChain(
    TraceableChain, StreamableChain, ConversationalRetrievalChain
):
    pass
```

파이썬의 **MRO(Method Resolution Order)** 를 이용한 구조입니다.
`chain(...)`을 호출하면 왼쪽부터 찾아서 `TraceableChain.__call__`이 먼저 실행되고,
트레이스 핸들러를 추가한 뒤 `super().__call__`로 다음 클래스에 넘깁니다.
**체인 호출 코드를 한 줄도 고치지 않고** 모든 호출에 관측이 붙습니다.

같은 목적의 도구로 LangSmith, Langfuse, Phoenix 등이 있고,
요즘 LangChain은 환경 변수만으로 켜지는 경우가 많습니다.

```bash
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=...
```

> **트레이싱은 선택이 아니라 필수입니다.** RAG는 "왜 이런 답이 나왔는지"가
> 코드만 봐서는 절대 알 수 없는 시스템입니다.

## 4. 온라인 평가의 한계

사용자 피드백은 실제 사용 맥락을 반영한다는 큰 장점이 있지만,

- 데이터가 쌓이는 데 시간이 걸립니다
- 표본이 적어 통계적으로 흔들립니다
- 사용자는 **틀린 답도 그럴듯하면 좋아요**를 누릅니다
- 프롬프트를 고칠 때마다 처음부터 다시 모아야 합니다

그래서 **배포 전에 돌릴 수 있는 오프라인 평가**가 함께 필요합니다.

## 5. 오프라인 평가: 골든셋 만들기

가장 확실한 투자는 **질문–정답 쌍 30~50개**를 손으로 만드는 것입니다.
한두 시간이면 되고, 이후 모든 변경을 숫자로 비교할 수 있게 됩니다.

```python
golden = [
    {
        "question": "ReAct의 핵심 아이디어는?",
        "answer": "추론(reasoning)과 행동(acting)을 번갈아 수행해 서로를 보완하는 것",
        "pages": [1, 2],
    },
    # ... 30개
]
```

만들 때의 요령입니다.

- **실제 사용자가 할 법한 질문**으로 씁니다. 문서 문장을 그대로 베끼면 검색이 너무 쉬워집니다.
- **어려운 질문을 일부러 넣습니다.** 여러 페이지를 종합해야 하는 질문, 표를 봐야 하는 질문.
- **답이 문서에 없는 질문**도 3~5개 넣습니다. "모른다"고 답하는지 확인하는 용도입니다.

### 검색 평가

4편에서 본 hit rate에 순위까지 반영하려면 MRR을 씁니다.

```python
def mrr(retriever, cases) -> float:
    """정답이 몇 번째로 검색됐는지의 역수 평균. 1에 가까울수록 좋다."""
    total = 0.0
    for case in cases:
        docs = retriever.invoke(case["question"])
        for rank, doc in enumerate(docs, start=1):
            if doc.metadata.get("page") in case["pages"]:
                total += 1 / rank
                break
    return total / len(cases)
```

### 답변 평가: LLM을 심판으로

답변이 정답과 같은 뜻인지 사람이 매번 읽을 수는 없습니다. LLM에게 채점을 시킵니다.

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

judge_prompt = ChatPromptTemplate.from_template(
    """다음 답변이 기준 정답과 사실상 같은 내용인지 판단하세요.
표현이 달라도 핵심 사실이 일치하면 정답으로 봅니다.
0(틀림) 또는 1(맞음)만 출력하세요.

[질문] {question}
[기준 정답] {reference}
[모델 답변] {answer}"""
)

judge = judge_prompt | ChatOpenAI(model="gpt-4o", temperature=0)

def accuracy(chain, cases) -> float:
    hits = 0
    for case in cases:
        answer = chain.invoke({"input": case["question"]})["answer"]
        verdict = judge.invoke({
            "question": case["question"],
            "reference": case["answer"],
            "answer": answer,
        }).content.strip()
        hits += 1 if verdict.startswith("1") else 0
    return hits / len(cases)
```

**심판 모델은 답변 모델보다 크고 좋은 것**을 쓰세요. 채점은 자주 하지 않으니 비용이 크지 않습니다.

RAG 전용 지표를 자동으로 계산해 주는 RAGAS 같은 라이브러리도 있습니다. 대표적인 지표는 이렇습니다.

| 지표 | 묻는 것 |
|------|--------|
| **Faithfulness** | 답변이 검색된 근거에 실제로 있는 내용인가 (환각 탐지) |
| **Answer Relevancy** | 답변이 질문에 답하고 있는가 |
| **Context Precision** | 검색된 청크 중 실제로 쓸모 있는 비율 |
| **Context Recall** | 정답에 필요한 근거를 다 가져왔는가 |

**Faithfulness와 Context Recall이 낮다**면 검색 문제이고,
**Context는 좋은데 Faithfulness가 낮다**면 프롬프트 문제입니다. 원인 분리에 유용합니다.

## 6. 실험을 제대로 돌리는 법

```python
configs = {
    "base":     dict(chunk_size=500,  k=2, search_type="similarity"),
    "bigger":   dict(chunk_size=1000, k=4, search_type="similarity"),
    "mmr":      dict(chunk_size=1000, k=4, search_type="mmr"),
}

for name, cfg in configs.items():
    chain, retriever = build(**cfg)
    print(f"{name:8} | hit={hit_rate(retriever, golden):.2f} "
          f"| mrr={mrr(retriever, golden):.2f} "
          f"| acc={accuracy(chain, golden):.2f}")
```

지켜야 할 원칙이 세 가지입니다.

1. **한 번에 하나만 바꾼다.** 청크 크기와 k를 동시에 바꾸면 무엇이 효과였는지 알 수 없습니다.
2. **`temperature=0`으로 고정한다.** 실행마다 답이 달라지면 비교가 무의미합니다.
3. **결과를 기록한다.** 설정과 점수를 파일이나 스프레드시트에 남기세요. 3주 뒤의 나는 기억 못 합니다.

## 7. 정리

- 컴포넌트를 **이름 → 빌더 맵**으로 등록하면 조합 실험이 쉬워진다.
- 선택을 **대화 단위로 고정**해야 평가가 오염되지 않는다.
- 사용자 평가를 가중 랜덤에 되먹이면 좋은 조합이 자연히 더 자주 쓰인다. **탐색 여지를 남기는 것**을 잊지 말자.
- 평가 파이프라인은 조용히 고장 난다. 키 생성은 헬퍼로 모으고, 테스트를 하나 두자.
- **트레이싱 없이 RAG를 디버깅할 수 없다.**
- 골든셋 30~50개면 검색·답변 품질을 숫자로 비교할 수 있다. 한 번에 하나씩 바꿔 가며 측정하자.

## 실습

1. 골든셋 10개를 만들어 hit rate와 MRR을 재 보세요. 지금 설정의 점수는 몇인가요?
2. k만 2 → 4로 바꿔 다시 재 보세요. 얼마나 올라가나요?
3. LLM 심판으로 정확도를 재고, 심판의 판정 결과를 직접 5개만 읽어 보세요. 심판이 틀린 경우는 없나요?

마지막 편에서는 지금까지 나온 함정들을 한자리에 모으고,
프로덕션으로 가기 전에 확인할 체크리스트를 정리합니다.
