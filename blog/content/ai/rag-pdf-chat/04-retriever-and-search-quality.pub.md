---
title: "[RAG 04] 리트리버 — 검색 품질이 답변의 상한선"
date: 2026-09-08
category: "AI"
categories:
  - "AI"
  - "LLM"
tags:
  - "RAG"
  - "Retriever"
  - "MMR"
  - "Hybrid Search"
  - "Reranking"
summary: "k와 메타데이터 필터부터 MMR, 하이브리드 검색, 리랭킹, 부모-자식 청킹까지. 검색 결과를 실제로 좋게 만드는 방법을 효과 순으로 정리합니다."
---

RAG에서 답변이 나쁠 때 사람들은 대개 모델을 바꾸거나 프롬프트를 다듬습니다.
하지만 원인의 절반 이상은 **검색**에 있습니다.
LLM은 프롬프트에 들어온 것만 볼 수 있으므로, 근거가 안 들어오면 좋은 답이 나올 방법이 없습니다.

> **검색 품질이 답변 품질의 상한선이다.**

이번 편은 그 상한선을 끌어올리는 방법입니다.

## 1. 리트리버란

리트리버는 **질문 문자열을 받아 `Document` 리스트를 돌려주는 것**, 그게 전부입니다.

```python
retriever = store.as_retriever(search_kwargs={"k": 4})
docs = retriever.invoke("이 논문의 핵심 기여는?")
```

인터페이스가 단순해서 벡터 검색이 아닌 것도 리트리버가 될 수 있습니다.
키워드 검색, 여러 검색기의 앙상블, 리랭킹을 붙인 검색기 모두 같은 자리에 끼워 넣을 수 있습니다.
뒤에서 나오는 모든 기법은 **체인 코드를 건드리지 않고 리트리버만 교체**하는 방식으로 적용됩니다.

## 2. 가장 먼저 만질 손잡이: k

`k`는 "청크를 몇 개 가져올까"입니다.

```python
retriever = store.as_retriever(search_kwargs={"k": 4})
```

| k | 결과 |
|---|------|
| 1~2 | 딱 맞으면 정확하지만, **한 번 빗나가면 답이 없습니다.** 여러 곳에 흩어진 정보를 종합하는 질문에 특히 취약합니다. |
| **4~8** | **대부분의 문서에서 무난한 출발점.** |
| 10 이상 | 근거는 많아지지만 노이즈와 토큰 비용이 늘고, 중요한 내용이 가운데 묻힐 수 있습니다. |

`pdf-app`은 k를 1, 2, 3으로 등록해 두고 비교합니다(`app/chat/vector_stores/__init__.py`).

```python
retriever_map = {
    "pinecone_1": partial(build_retriever, k=1),
    "pinecone_2": partial(build_retriever, k=2),
    "pinecone_3": partial(build_retriever, k=3),
}
```

`functools.partial`은 "인자 일부를 미리 채워 둔 함수"를 만드는 도구입니다.
`build_retriever(chat_args, k)` 중 `k`만 고정해 두고, 나중에 `chat_args`만 넘겨 호출하는 식이죠.
이렇게 **후보를 여러 개 등록해 두고 실제 사용자 반응으로 비교하는 구조**는 9편에서 자세히 다룹니다.

다만 이 값들은 다소 작습니다. 청크가 500자라면 k=2는 겨우 1000자 분량의 근거로 답을 만드는 셈입니다.
직접 만들 때는 **k=4에서 시작**하세요.

## 3. 메타데이터 필터 — 기능이자 보안 장치

`pdf-app`의 리트리버는 이렇게 생겼습니다.

```python
def build_retriever(chat_args: ChatArgs, k):
    search_kwargs = {"filter": {"pdf_id": chat_args.pdf_id}, "k": k}
    return vector_store.as_retriever(search_kwargs=search_kwargs)
```

`filter`는 "이 조건에 맞는 벡터 중에서만 유사도 검색을 하라"는 뜻입니다.
2편에서 청크 메타데이터에 `pdf_id`를 심어 둔 것이 여기서 쓰입니다.

이 필터가 없으면 **A 문서를 보면서 물었는데 B 문서 내용으로 답하는** 사고가 납니다.
그리고 여러 사용자가 쓰는 서비스라면 이건 단순한 품질 문제가 아니라 **정보 유출**입니다.

```python
search_kwargs = {
    "filter": {"pdf_id": chat_args.pdf_id, "user_id": chat_args.user_id},
    "k": k,
}
```

> **멀티테넌트 RAG의 첫 번째 규칙: 소유자 필터는 리트리버 안쪽에 둔다.**
> "검색해 온 뒤 애플리케이션에서 걸러내겠다"는 접근은 한 번만 빠뜨려도 남의 문서가 새어 나갑니다.
> 검색 자체가 남의 데이터를 볼 수 없게 만드세요. 테넌트를 물리적으로 분리하는
> 네임스페이스(Pinecone)나 컬렉션 분리도 좋은 선택입니다.

필터 문법은 스토어마다 조금씩 다릅니다. Pinecone은 MongoDB 스타일 연산자를 지원합니다.

```python
{"filter": {"pdf_id": {"$in": ["id-1", "id-2"]}, "page": {"$gte": 10}}}
```

FAISS는 메타데이터 딕셔너리 매칭이나 콜러블 필터를 지원합니다.

```python
store.as_retriever(search_kwargs={"k": 4, "filter": {"pdf_id": "abc"}})
```

## 4. 검색 결과가 서로 비슷할 때: MMR

벡터 검색의 흔한 실패가 있습니다. 상위 4개가 **거의 같은 내용**인 경우입니다.
겹침(overlap)을 준 인접 청크들이 나란히 뽑히면 이런 일이 자주 생깁니다.

MMR(Maximal Marginal Relevance)은 "질문과의 유사도"와 "이미 뽑은 것들과의 차별성"을 함께 보고 고릅니다.

```python
retriever = store.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 5, "fetch_k": 25, "lambda_mult": 0.5},
)
```

| 파라미터 | 의미 |
|----------|------|
| `fetch_k` | 후보를 몇 개 먼저 가져올지 (여기서 다양성을 고려해 k개를 고름) |
| `lambda_mult` | 1에 가까울수록 유사도 우선, 0에 가까울수록 다양성 우선 (0.5가 무난) |

"답변이 같은 말만 반복한다", "문서 여기저기를 종합해야 하는 질문에 약하다" 싶을 때 먼저 시도해 볼 옵션입니다.

## 5. 벡터 검색이 약한 곳: 하이브리드 검색

벡터 검색은 **정확한 문자열**에 약합니다.
에러 코드 `ERR_5031`, 제품명 `XR-200`, 사람 이름 같은 것은 의미로 뭉개지면 오히려 못 찾습니다.

키워드 검색(BM25)과 섞으면 서로의 약점을 메웁니다.

```bash
pip install rank_bm25
```

```python
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever

bm25 = BM25Retriever.from_documents(chunks)   # 청크 리스트가 그대로 필요
bm25.k = 4

vector_retriever = store.as_retriever(search_kwargs={"k": 4})

hybrid = EnsembleRetriever(
    retrievers=[bm25, vector_retriever],
    weights=[0.4, 0.6],
)
docs = hybrid.invoke("ERR_5031 오류는 왜 발생하나?")
```

`EnsembleRetriever`는 두 결과를 순위 기반으로 합칩니다(Reciprocal Rank Fusion).
가중치는 문서 성격에 따라 조정하세요. 기술 문서·로그처럼 식별자가 많으면 BM25 비중을 높입니다.

> `BM25Retriever`는 청크를 메모리에 들고 검색합니다. 문서가 아주 많다면
> Elasticsearch·OpenSearch나 Postgres 전문 검색처럼 **키워드 검색을 담당하는 저장소**를 따로 두는 편이 낫습니다.

## 6. 정확도를 크게 올리는 한 수: 리랭킹

지금까지는 "임베딩 유사도"만으로 순위를 매겼습니다.
임베딩은 질문과 문서를 **각각 따로** 벡터로 만들기 때문에, 미묘한 관련성을 놓칠 수 있습니다.

리랭커(cross-encoder)는 **질문과 문서를 함께 넣어** 관련도를 채점합니다. 훨씬 정확하지만 느립니다.
그래서 조합이 정해져 있습니다.

> **넓게 뽑고(k=20~30), 정확하게 추린다(상위 3~5개만 LLM에 전달).**

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder

reranker = CrossEncoderReranker(
    model=HuggingFaceCrossEncoder(model_name="BAAI/bge-reranker-v2-m3"),
    top_n=4,
)

retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=store.as_retriever(search_kwargs={"k": 25}),
)
```

`ContextualCompressionRetriever`는 "기본 리트리버로 뽑고 → 압축기로 추리는" 패턴을 감싼 것입니다.
압축기 자리에 리랭커 대신 Cohere Rerank 같은 API를 넣을 수도 있습니다.

체감 효과가 큰 편이지만, 로컬 리랭커는 모델 로딩과 추론 시간이 있으니
**응답 지연을 측정해 보고** 도입하세요.

## 7. 질문 자체를 바꿔 보기: MultiQuery

사용자의 질문이 문서의 표현과 많이 다를 때가 있습니다.
LLM으로 질문을 여러 방식으로 바꿔 각각 검색한 뒤 합치는 방법이 있습니다.

```python
from langchain.retrievers.multi_query import MultiQueryRetriever

retriever = MultiQueryRetriever.from_llm(
    retriever=store.as_retriever(search_kwargs={"k": 4}),
    llm=ChatOpenAI(model="gpt-4o-mini", temperature=0),
)
```

검색 재현율은 올라가지만 **LLM 호출이 한 번 더** 늘어 느려지고 비싸집니다.
"검색이 자꾸 빗나간다"는 문제가 확인된 뒤에 쓰세요.

## 8. 작게 검색하고 크게 전달하기: 부모-자식 청킹

2편에서 본 딜레마 기억하시나요? 작은 청크는 검색이 정확하고, 큰 청크는 문맥이 풍부합니다.
둘 다 갖는 방법이 있습니다.

> **작은 청크로 검색하고, LLM에는 그 청크가 속한 큰 문단을 넘긴다.**

```python
from langchain.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore

retriever = ParentDocumentRetriever(
    vectorstore=store,
    docstore=InMemoryStore(),                   # 운영에서는 Redis/파일 스토어
    child_splitter=RecursiveCharacterTextSplitter(chunk_size=400),
    parent_splitter=RecursiveCharacterTextSplitter(chunk_size=2000),
)
retriever.add_documents(docs)
```

검색 정확도와 문맥 충분성을 함께 잡는, 실무에서 효과가 좋은 패턴입니다.

## 9. 무엇부터 해야 하나

효과 대비 비용 순서입니다. 위에서부터 시도하세요.

| 순서 | 방법 | 비용 | 효과 |
|------|------|------|------|
| 1 | **k를 4~8로 올리기** | 없음 | 큼 |
| 2 | **메타데이터 필터 확인** | 없음 | 큼 (정확성·보안) |
| 3 | **청킹 재조정** (2편) | 재인덱싱 | 큼 |
| 4 | MMR | 없음 | 중간 |
| 5 | 하이브리드 검색 | 인덱스 하나 더 | 중간~큼 (문서 성격에 따라) |
| 6 | 리랭킹 | 지연 증가 | 큼 |
| 7 | MultiQuery | LLM 호출 추가 | 중간 |
| 8 | 부모-자식 청킹 | 구조 변경 | 큼 |

## 10. "좋아졌다"를 숫자로 확인하기

위 방법들을 감으로 비교하면 끝이 없습니다. **작은 평가셋**이면 충분히 판단할 수 있습니다.

질문과 "정답이 들어 있는 페이지"를 20~30쌍 만들어 두세요. 만드는 데 한 시간이면 됩니다.

```python
eval_set = [
    {"q": "ReAct의 핵심 아이디어는?", "pages": [1, 2]},
    {"q": "실험에 사용한 벤치마크는?", "pages": [5]},
    # ... 20~30개
]

def hit_rate(retriever, eval_set) -> float:
    hits = 0
    for case in eval_set:
        found = {d.metadata.get("page") for d in retriever.invoke(case["q"])}
        if found & set(case["pages"]):
            hits += 1
    return hits / len(eval_set)

print("k=2 :", hit_rate(store.as_retriever(search_kwargs={"k": 2}), eval_set))
print("k=4 :", hit_rate(store.as_retriever(search_kwargs={"k": 4}), eval_set))
print("mmr :", hit_rate(
    store.as_retriever(search_type="mmr", search_kwargs={"k": 4, "fetch_k": 20}),
    eval_set,
))
```

**LLM을 붙이기 전에 이 숫자부터 올리세요.** 검색이 정답을 못 물어오면 그 뒤는 볼 것도 없습니다.
이 평가셋은 9편에서 답변 품질 평가로도 재사용합니다.

## 11. 정리

- 리트리버는 "질문 → 문서 리스트"일 뿐이라, 무엇으로든 교체할 수 있다.
- `k=4`에서 시작하고, 메타데이터 필터는 **기능이자 보안**이다.
- 결과가 서로 비슷하면 MMR, 고유명사에 약하면 하이브리드, 정확도가 더 필요하면 리랭킹.
- 작은 평가셋으로 hit rate를 재면, 바꾼 것이 나아졌는지 감이 아니라 숫자로 판단할 수 있다.

## 실습

1. 3편에서 기록해 둔 "만족스럽지 않은 질문"으로 hit rate를 재고, k를 올려 보세요.
2. 문서에 있는 고유명사·코드로 검색해 보세요. 벡터 검색만으로 찾나요? BM25를 섞으면 달라지나요?
3. `filter`를 일부러 빼고 여러 PDF를 인덱싱한 뒤 질문해 보세요. 어떤 사고가 나는지 직접 확인해 보세요.

다음 편에서는 검색해 온 청크를 **어떻게 프롬프트에 담아 LLM에게 넘기는지** 다룹니다.
