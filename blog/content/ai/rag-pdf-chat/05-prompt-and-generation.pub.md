---
title: "[RAG 05] 프롬프트와 생성 — 환각을 줄이고 출처를 붙이기"
date: 2026-09-08
category: "AI"
categories:
  - "AI"
  - "LLM"
tags:
  - "RAG"
  - "Prompt Engineering"
  - "LangChain"
  - "Hallucination"
summary: "검색된 청크가 프롬프트로 조립되는 과정을 뜯어보고, 근거 밖 답변을 막는 지시문·출처 표기·컨텍스트 예산 계산·모델 선택 기준을 정리합니다."
---

검색이 좋은 청크를 물어 왔다면 절반은 끝났습니다.
이제 그것을 **프롬프트에 잘 담아 LLM에게 넘기는 일**이 남았습니다.
이번 편은 RAG의 A(Augmentation)와 G(Generation)입니다.

## 1. 프롬프트는 어떻게 조립되는가

1편에서 쓴 `create_stuff_documents_chain`이 하는 일은 생각보다 단순합니다.

```python
chain = create_stuff_documents_chain(llm, prompt)
```

"stuff"는 **검색된 문서를 프롬프트에 그대로 채워 넣는다(stuff)** 는 뜻입니다.
`{context}` 자리에 문서들의 `page_content`를 이어 붙여 넣고 LLM을 한 번 호출합니다.

실제로 어떤 문자열이 만들어지는지 궁금하다면 직접 확인해 볼 수 있습니다.

```python
docs = retriever.invoke("이 논문의 기여는?")
print(prompt.format(context="\n\n".join(d.page_content for d in docs),
                    input="이 논문의 기여는?"))
```

**프롬프트를 눈으로 보는 것**은 RAG 디버깅에서 가장 중요한 습관 중 하나입니다.
답이 이상할 때, 사람이 그 프롬프트를 읽고 답할 수 있는지 먼저 확인하세요.
사람도 못 답하면 그건 검색 문제(4편)이지 프롬프트 문제가 아닙니다.

## 2. 좋은 RAG 프롬프트의 구성

RAG 프롬프트에는 네 가지가 들어갑니다.

```python
from langchain_core.prompts import ChatPromptTemplate

SYSTEM = """당신은 업로드된 문서에 대해 답변하는 도우미입니다.

규칙:
1. 아래 <context>에 있는 내용만 근거로 답하세요.
2. context에 답이 없으면 "문서에서 해당 내용을 찾을 수 없습니다"라고 답하고,
   추측하거나 일반 지식으로 채우지 마세요.
3. 답변에 사용한 근거의 페이지 번호를 문장 끝에 (p.12) 형식으로 표기하세요.
4. 한국어로, 간결하게 답하세요.

<context>
{context}
</context>"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM),
    ("human", "{input}"),
])
```

| 구성 | 역할 |
|------|------|
| **역할 지정** | 무엇을 하는 도우미인지 |
| **근거 제한** | "context에 있는 것만" — 환각을 줄이는 가장 큰 한 줄 |
| **모를 때의 행동** | 모른다고 말할 수 있게 허용. 이게 없으면 모델은 지어냅니다 |
| **형식 지정** | 언어, 길이, 출처 표기 방식 |

특히 **"모르면 모른다고 하라"** 를 빠뜨리지 마세요.
LLM은 기본적으로 "도움이 되려" 하기 때문에, 명시적으로 허용해 주지 않으면
빈약한 근거로도 그럴듯한 답을 만들어 냅니다.

### 얼마나 효과가 있는지 직접 확인해 보기

문서에 없는 내용을 물어보고 지시문 유무를 비교해 보세요.

```python
q = "이 논문의 저자가 다음에 쓴 후속 논문 제목은?"   # 문서에 없는 정보
print(chain.invoke({"input": q})["answer"])
```

지시문이 있으면 "찾을 수 없습니다", 없으면 그럴듯한 가짜 제목이 나오는 경우가 많습니다.
**이 차이를 눈으로 한 번 보는 것**이 프롬프트 엔지니어링에 대한 감을 잡는 가장 빠른 길입니다.

## 3. 청크마다 출처 정보 붙이기

기본 설정에서는 `{context}`에 본문만 들어갑니다. 그러면 모델이 페이지 번호를 알 방법이 없죠.
`document_prompt`로 각 청크가 어떤 모양으로 들어갈지 정할 수 있습니다.

```python
from langchain_core.prompts import PromptTemplate

document_prompt = PromptTemplate.from_template(
    "[출처: {page_label}쪽]\n{page_content}"
)

combine = create_stuff_documents_chain(
    llm,
    prompt,
    document_prompt=document_prompt,
    document_separator="\n\n---\n\n",
)
```

`{page_content}`는 본문, 그 외 중괄호 변수는 **메타데이터 키**입니다.
2편에서 `page_label`을 메타데이터에 심어 둔 것이 여기서 열매를 맺습니다.

여기서 `page`가 아니라 `page_label`을 쓰는 것이 중요합니다.
`PyPDFLoader`의 `page`는 0부터 시작하므로, 그대로 넣으면 모든 출처가 한 쪽씩 밀립니다.
템플릿 안에서는 `+ 1` 같은 계산을 할 수 없으니, **인제스트에서 미리 변환해 둔 값**이 필요합니다(2편).

이제 `{context}`는 이렇게 조립됩니다.

```text
[출처: 3쪽]
ReAct는 추론(Reasoning)과 행동(Acting)을 번갈아 수행하는 프레임워크로...

---

[출처: 5쪽]
실험은 HotpotQA와 FEVER에서 수행되었으며...
```

모델이 페이지 번호를 볼 수 있으니, 프롬프트의 "(p.12) 형식으로 표기하세요" 지시가 실제로 동작합니다.

### 코드로 출처를 붙이는 방법도 있다

모델에게 맡기지 않고 애플리케이션에서 붙이는 편이 더 정확합니다.
`create_retrieval_chain`의 결과에 이미 근거 문서가 들어 있습니다.

```python
result = chain.invoke({"input": q})

sources = sorted({
    (doc.metadata.get("pdf_id"), doc.metadata["page_label"])
    for doc in result["context"]
})
print(result["answer"])
print("근거:", ", ".join(f"{page}쪽" for _, page in sources))
```

UI에서는 이 페이지 번호를 **PDF 뷰어의 해당 페이지로 이동하는 링크**로 만들면 좋습니다.
`pdf-app`의 프론트엔드가 PDF 뷰어와 채팅 패널을 나란히 두는 이유가 이것입니다.
사용자가 답을 즉시 검증할 수 있으면, 환각의 위험이 크게 줄어듭니다.

## 4. 컨텍스트 예산 계산하기

프롬프트에 넣는 양은 무제한이 아닙니다. 대략의 예산을 계산해 두세요.

```text
프롬프트 = 시스템 지시문 + (청크 크기 × k) + 대화 기록 + 질문
```

청크 1000자에 k=8이면 근거만 8000자입니다. 여기에 대화 기록까지 붙으면 꽤 됩니다.
한국어는 영어보다 글자당 토큰이 많다는 점도 기억해 두세요.

실제 토큰 수를 재고 싶다면:

```python
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")
text = prompt.format(context=ctx, input=q)
print(len(enc.encode(text)), "토큰")
```

컨텍스트가 부족하면 이렇게 대응합니다.

| 상황 | 대응 |
|------|------|
| 청크가 너무 큼 | `chunk_size` 축소 (2편) |
| k가 너무 큼 | 리랭킹으로 넓게 뽑아 좁게 전달 (4편) |
| 대화 기록이 김 | 윈도우 메모리나 요약 메모리 (6편) |
| 근본적으로 양이 많음 | map-reduce 방식 검토 (아래) |

### stuff 말고 다른 방식

문서를 전부 넣기 어려울 때 쓰는 전통적인 전략들입니다.

| 방식 | 동작 | 특징 |
|------|------|------|
| **stuff** | 전부 한 프롬프트에 | **기본값.** 빠르고 싸고 문맥 연결이 좋음 |
| map-reduce | 청크별로 답을 만들고 합침 | 아주 많은 문서 요약에 적합. 느리고 비쌈 |
| refine | 답을 순차적으로 다듬음 | 순서가 중요한 문서. 느림 |

**RAG에서는 stuff가 기본**입니다. 애초에 검색으로 양을 줄여 놓았기 때문입니다.
map-reduce/refine이 필요하다고 느껴진다면, 대개는 검색을 개선하는 편이 낫습니다.

## 5. 모델 고르기

`pdf-app`은 후보 두 개를 등록해 두고 비교합니다(`app/chat/llms/__init__.py`).

```python
llm_map = {
    "gpt-4": partial(build_llm, model_name="gpt-4"),
    "gpt-3.5-turbo": partial(build_llm, model_name="gpt-3.5-turbo"),
}
```

```python
def build_llm(chat_args: ChatArgs, model_name):
    return ChatOpenAI(streaming=chat_args.streaming, model_name=model_name)
```

지금 새로 만든다면 최신 모델로 바꾸면 됩니다. 선택 기준은 단순합니다.

- **작고 빠른 모델로 시작하세요.** RAG는 근거를 프롬프트에 넣어 주므로,
  "지식"보다 "주어진 텍스트를 읽고 정리하는 능력"이 중요합니다. 이건 작은 모델도 꽤 잘합니다.
- 답변이 부실하면 **모델을 키우기 전에 검색부터 의심**하세요.
- 요약·번역 같은 단순 작업은 작은 모델, 여러 근거를 종합하는 추론은 큰 모델로 나눠도 좋습니다.

`streaming=chat_args.streaming`이라는 인자가 눈에 띌 텐데, 7편에서 이 플래그가
왜 중요하고 어떤 함정을 만드는지 자세히 다룹니다.

### temperature

```python
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
```

`temperature`는 생성의 무작위성입니다. 문서 기반 질의응답은 **0에 가깝게** 두세요.
같은 질문에 같은 답이 나와야 디버깅과 평가가 가능합니다.

## 6. 환각을 줄이는 실전 기법

| 기법 | 방법 |
|------|------|
| **근거 제한 지시** | "context에 있는 내용만" — 가장 기본이자 효과가 큼 |
| **거절 허용** | "없으면 찾을 수 없다고 답하라" |
| **출처 강제** | 문장마다 페이지 표기를 요구하면 근거 없는 문장을 만들기 어려워짐 |
| **검색 결과 없음 처리** | 검색 결과가 비었으면 LLM을 아예 호출하지 않는다 |
| **점수 임계값** | 유사도가 낮은 청크는 버린다 |
| **답변 검증** | 답변이 근거에 실제로 있는지 별도 호출로 확인 (비용 증가) |

검색 결과가 없을 때 LLM을 호출하지 않는 것은 코드 몇 줄이면 됩니다.

```python
docs = retriever.invoke(question)
if not docs:
    answer = "관련 내용을 문서에서 찾지 못했습니다."
else:
    answer = chain.invoke({"input": question})["answer"]
```

유사도 임계값을 쓰려면 이렇게 합니다.

```python
retriever = store.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={"score_threshold": 0.5, "k": 5},
)
```

임계값은 스토어와 임베딩 모델에 따라 적정값이 다릅니다.
3편에서 본 것처럼 점수 체계가 제각각이므로, **실제 데이터로 분포를 보고 정하세요.**

## 7. 지금까지를 하나로

1~5편의 내용을 합치면 이런 스크립트가 됩니다. 이게 "단발 질의 RAG"의 완성형입니다.

```python
import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains.retrieval import create_retrieval_chain

load_dotenv()
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

SYSTEM = """당신은 업로드된 문서에 대해 답변하는 도우미입니다.

규칙:
1. 아래 <context>에 있는 내용만 근거로 답하세요.
2. context에 답이 없으면 "문서에서 해당 내용을 찾을 수 없습니다"라고 답하고,
   추측하거나 일반 지식으로 채우지 마세요.
3. 답변에 사용한 근거의 페이지 번호를 문장 끝에 (p.12) 형식으로 표기하세요.
4. 한국어로, 간결하게 답하세요.

<context>
{context}
</context>"""

# ── ① 인제스트 ──────────────────────────────────────────
if not os.path.exists("faiss_index"):
    docs = PyPDFLoader("paper.pdf").load()
    chunks = RecursiveCharacterTextSplitter(
        chunk_size=1000, chunk_overlap=150,
        separators=["\n\n", "\n", ". ", "다. ", " ", ""],
    ).split_documents(docs)
    chunks = [c for c in chunks if len(c.page_content.strip()) >= 100]

    for chunk in chunks:                      # 사람이 읽는 페이지 번호를 미리 심는다 (2편)
        chunk.metadata["page_label"] = chunk.metadata.get("page", 0) + 1

    FAISS.from_documents(chunks, embeddings).save_local("faiss_index")

# ── ② 질의 ──────────────────────────────────────────────
store = FAISS.load_local("faiss_index", embeddings,
                         allow_dangerous_deserialization=True)
retriever = store.as_retriever(
    search_type="mmr", search_kwargs={"k": 5, "fetch_k": 25}
)

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM),
    ("human", "{input}"),
])
document_prompt = PromptTemplate.from_template("[출처: {page_label}쪽]\n{page_content}")

chain = create_retrieval_chain(
    retriever,
    create_stuff_documents_chain(
        ChatOpenAI(model="gpt-4o-mini", temperature=0),
        prompt,
        document_prompt=document_prompt,
    ),
)

result = chain.invoke({"input": "이 문서의 핵심 주장을 3문장으로 요약해줘"})
print(result["answer"])
print("근거:", sorted({d.metadata["page_label"] for d in result["context"]}))
```

> 이미 `faiss_index`를 만들어 둔 상태라면 청크에 `page_label`이 없습니다.
> 인덱스 디렉터리를 지우고 다시 실행하세요. **메타데이터를 바꾸면 재인덱싱이 필요합니다.**

여기까지가 **RAG의 본체**입니다. 6편부터는 이것을 "서비스"로 만드는 이야기입니다.

## 실습

1. 시스템 프롬프트에서 규칙을 하나씩 지워 가며 같은 질문을 던져 보세요. 어떤 규칙이 가장 큰 차이를 만드나요?
2. `document_prompt`에 `page` 대신 문서 제목이나 섹션명을 넣으려면 무엇이 필요할까요? (힌트: 2편)
3. 문서에 없는 내용을 묻는 질문 5개를 만들어, 모델이 몇 번이나 "모른다"고 답하는지 세어 보세요.

다음 편은 **대화형 RAG**입니다. "그거 한계가 뭐야?" 같은 후속 질문을 어떻게 처리하는지 다룹니다.
