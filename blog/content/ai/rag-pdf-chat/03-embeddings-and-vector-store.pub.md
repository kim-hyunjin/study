---
title: "[RAG 03] 임베딩과 벡터 스토어 — 의미로 검색한다는 것"
date: 2026-09-08
category: "AI"
categories:
  - "AI"
  - "LLM"
tags:
  - "RAG"
  - "Embedding"
  - "Vector Database"
  - "Pinecone"
  - "FAISS"
summary: "텍스트가 벡터가 되는 원리와 코사인 유사도, 임베딩 모델 선택 기준, FAISS와 Pinecone의 차이, 그리고 중복 인제스트를 막는 결정적 ID 전략을 다룹니다."
---

앞 편에서 문서를 청크로 잘랐습니다. 이제 그 청크들을 **검색 가능한 형태**로 바꿔 저장할 차례입니다.
인제스트 파이프라인의 뒷 절반, **Embed와 Store**입니다.

## 1. 임베딩이란 무엇인가

임베딩은 **텍스트를 숫자 배열(벡터)로 바꾸는 것**입니다.

```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vector = embeddings.embed_query("고양이는 포유류다")

print(len(vector))    # 1536
print(vector[:5])     # [0.0123, -0.0456, 0.0789, ...]
```

여기서 중요한 성질은 하나입니다.

> **의미가 비슷한 문장은 벡터 공간에서 가까운 곳에 놓인다.**

"고양이는 포유류다"와 "냥이는 젖먹이 동물이다"는 **글자가 거의 겹치지 않지만** 벡터는 가깝습니다.
반대로 "고양이는 포유류다"와 "고양이 사료 가격은 얼마인가"는 단어가 겹쳐도 벡터는 상대적으로 멉니다.

이게 키워드 검색과의 결정적 차이입니다.

| | 키워드 검색 (BM25 등) | 벡터 검색 |
|---|---|---|
| 매칭 기준 | 단어가 겹치는가 | 의미가 비슷한가 |
| 강한 곳 | 고유명사, 코드, 오탈자 없는 정확한 용어 | 표현이 다른 같은 뜻, 질문형 문장 |
| 약한 곳 | "반려묘"로 검색 시 "고양이" 문서를 못 찾음 | 정확한 제품 코드 `AB-1234` 검색 |

둘은 경쟁 관계가 아니라 보완 관계라서, 실무에서는 섞어 쓰는 경우가 많습니다(4편의 하이브리드 검색).

## 2. 얼마나 가까운가: 코사인 유사도

두 벡터가 얼마나 비슷한지는 보통 **코사인 유사도**로 잽니다.
두 벡터가 이루는 각도의 코사인 값입니다.

$$
\text{sim}(a, b) = \cos\theta = \frac{a \cdot b}{\lVert a \rVert \lVert b \rVert}
$$

- 값의 범위는 $-1 \sim 1$이고, **1에 가까울수록 비슷**합니다.
- 길이(크기)를 나눠서 없애므로 **문장의 길이에 영향을 덜 받습니다.** 긴 문서와 짧은 질문을 비교하기에 적합합니다.

직접 계산해 보면 감이 옵니다.

```python
import numpy as np
from langchain_openai import OpenAIEmbeddings

emb = OpenAIEmbeddings(model="text-embedding-3-small")

def sim(a: str, b: str) -> float:
    va, vb = emb.embed_query(a), emb.embed_query(b)
    va, vb = np.array(va), np.array(vb)
    return float(va @ vb / (np.linalg.norm(va) * np.linalg.norm(vb)))

print(sim("고양이는 포유류다", "냥이는 젖먹이 동물이다"))  # 높게 나온다
print(sim("고양이는 포유류다", "오늘 서울 날씨는 맑음"))    # 낮게 나온다
```

벡터 스토어가 하는 일이 바로 이 계산입니다.
질문 벡터 하나와 저장된 수만 개 벡터의 유사도를 계산해 **상위 k개**를 돌려줍니다.
전부 비교하면 느리므로 실제로는 근사 최근접 이웃(ANN) 알고리즘으로 빠르게 처리합니다.

## 3. 임베딩 모델 고르기

OpenAI 기준으로 두 가지가 주로 쓰입니다.

| 모델 | 차원 | 성격 |
|------|------|------|
| `text-embedding-3-small` | 1536 | **기본 선택.** 저렴하고 충분히 좋습니다. |
| `text-embedding-3-large` | 3072 | 정확도가 조금 더 높지만 비싸고 저장 용량도 두 배 |

`pdf-app`은 `OpenAIEmbeddings()`를 인자 없이 호출합니다. 이러면 라이브러리 기본 모델을 쓰게 되는데,
**모델명은 명시하는 편이 안전합니다.** 라이브러리 기본값이 바뀌면 인덱스와 질의의 모델이 어긋날 수 있습니다.

```python
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
```

한국어 문서가 많고 비용·프라이버시가 중요하다면 로컬 임베딩도 선택지입니다.

```python
from langchain_huggingface import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(model_name="intfloat/multilingual-e5-large")
```

API 호출이 없어 무료이고 데이터가 밖으로 나가지 않습니다. 대신 GPU가 없으면 인제스트가 느립니다.

### 반드시 지켜야 할 규칙 하나

> **인제스트와 질의에 같은 임베딩 모델을 써야 합니다.**

모델이 다르면 벡터 공간 자체가 달라서, 유사도 계산이 **아무 의미 없는 숫자**가 됩니다.
"검색 결과가 무작위처럼 보인다"의 흔한 원인이 이것입니다.
모델을 바꾸려면 **전체 재인덱싱**이 필요합니다. 차원 수가 다르면 벡터 DB가 아예 거부하기도 합니다.

그래서 임베딩 설정은 한 곳에만 두는 것이 좋습니다.
`pdf-app`이 `app/chat/embeddings/openai.py`에 모듈 하나로 분리해 둔 이유입니다.

```python
# app/chat/embeddings/openai.py
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
```

인제스트 코드도 질의 코드도 이 하나를 임포트해 씁니다. **엇갈릴 여지를 구조적으로 없애는 것**입니다.

### 비용과 속도

임베딩은 **답변 생성보다 훨씬 저렴**합니다. 논문 한 편 인덱싱은 부담이 없는 수준입니다.
다만 문서가 수천 개가 되면 이야기가 달라지므로 두 가지를 기억해 두세요.

- **인덱스는 저장하고 재사용한다.** 스크립트를 돌릴 때마다 다시 임베딩하면 그대로 비용입니다.
- **배치로 보낸다.** `from_documents`/`add_documents`는 내부적으로 여러 청크를 묶어 보냅니다.
  직접 반복문으로 한 개씩 보내지 마세요. 느리고 요청 수 제한(rate limit)에 걸리기 쉽습니다.

```python
# 청크가 아주 많다면 나눠서 넣고 실패 지점을 알 수 있게 한다
BATCH = 100
for i in range(0, len(chunks), BATCH):
    store.add_documents(chunks[i:i + BATCH])
    print(f"{min(i + BATCH, len(chunks))}/{len(chunks)} 저장")
```

## 4. 벡터 스토어 고르기

| 스토어 | 형태 | 좋은 점 | 아쉬운 점 |
|--------|------|---------|-----------|
| **FAISS** | 로컬 라이브러리 | 설치가 쉽고 빠름, 무료 | 서버가 여러 대면 공유가 번거로움 |
| **Chroma** | 로컬/서버 | 파이썬 친화적, 영속화 간단 | 대규모 운영 사례가 적은 편 |
| **pgvector** | PostgreSQL 확장 | **이미 쓰는 DB에 얹기 좋음**, 트랜잭션 | 대규모에서는 튜닝 필요 |
| **Pinecone** | 관리형 SaaS | 운영 부담 없음, 필터·네임스페이스 | 유료, 외부 의존 |

**추천 경로**는 이렇습니다.

1. 학습·프로토타입 → **FAISS**
2. 이미 Postgres를 쓰는 서비스 → **pgvector**
3. 인프라를 신경 쓰기 싫고 예산이 있다 → **Pinecone** (`pdf-app`의 선택)

인터페이스가 대부분 같아서 나중에 갈아타기가 어렵지 않습니다. **FAISS로 시작해도 손해가 아닙니다.**

### FAISS: 로컬에서 끝내기

```python
from langchain_community.vectorstores import FAISS

store = FAISS.from_documents(chunks, embeddings)
store.save_local("faiss_index")

# 다음 실행부터
store = FAISS.load_local(
    "faiss_index", embeddings, allow_dangerous_deserialization=True
)

# 나중에 문서를 더 넣을 때
store.add_documents(new_chunks)
store.save_local("faiss_index")
```

### Pinecone: `pdf-app`의 선택

먼저 인덱스를 한 번 만들어 둡니다. **차원 수가 임베딩 모델과 일치해야** 합니다.

```python
from pinecone import Pinecone, ServerlessSpec

pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
pc.create_index(
    name="pdf-app",
    dimension=1536,           # text-embedding-3-small의 차원
    metric="cosine",
    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
)
```

`pdf-app`의 코드는 이렇습니다(`app/chat/vector_stores/pinecone.py`).

```python
vector_store = Pinecone.from_existing_index(
    os.getenv("PINECONE_INDEX_NAME"), embeddings
)

def build_retriever(chat_args: ChatArgs, k):
    search_kwargs = {"filter": {"pdf_id": chat_args.pdf_id}, "k": k}
    return vector_store.as_retriever(search_kwargs=search_kwargs)
```

최신 패키지 구조에서는 임포트 경로만 달라집니다.

```python
# 옛 코드 (langchain 0.0.x)
from langchain.vectorstores import Pinecone

# 지금
from langchain_pinecone import PineconeVectorStore

vector_store = PineconeVectorStore.from_existing_index(
    os.environ["PINECONE_INDEX_NAME"], embeddings
)
```

`from_existing_index`라는 이름 그대로, **인덱스는 미리 만들어져 있다고 가정**합니다.
앱이 뜰 때마다 인덱스를 만들지 않는 것은 옳은 설계입니다. 인덱스 생성은 배포 시 한 번 하는 작업입니다.

## 5. 중복 인제스트를 막는 법

같은 PDF를 두 번 업로드하면 어떻게 될까요?
기본 동작에서는 **같은 내용의 벡터가 두 벌 저장**됩니다.
그러면 검색 결과 상위 4개가 사실상 2개의 중복이 되고, 그만큼 정보량이 줄어듭니다.

해결책은 **ID를 내용으로부터 결정적으로 만드는 것**입니다.

```python
import hashlib

def chunk_id(pdf_id: str, index: int, text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    return f"{pdf_id}-{index}-{digest}"

ids = [chunk_id(pdf_id, i, c.page_content) for i, c in enumerate(chunks)]
vector_store.add_documents(chunks, ids=ids)
```

같은 내용이면 같은 ID가 나오므로, 다시 넣어도 **덮어쓰기(upsert)** 가 되어 중복이 생기지 않습니다.
문서를 삭제할 때도 ID 규칙이 있으면 편합니다.

```python
# Pinecone: pdf_id 메타데이터로 한 문서의 벡터를 모두 삭제
index = pc.Index("pdf-app")
index.delete(filter={"pdf_id": pdf_id})
```

**문서 삭제 기능은 생각보다 일찍 필요해집니다.** 사용자가 PDF를 지웠는데 벡터가 남아 있으면
"지운 문서 내용으로 답하는" 곤란한 상황이 됩니다.

## 6. 저장된 것을 직접 들여다보기

인제스트가 끝나면 **검색이 되는지부터** 확인합니다. LLM은 아직 붙이지 않습니다.

```python
results = store.similarity_search_with_score("이 논문의 핵심 기여는?", k=5)

for doc, score in results:
    print(f"[score={score:.4f}] page={doc.metadata.get('page')}")
    print(doc.page_content[:150].replace("\n", " "), "\n")
```

여기서 나오는 조각들이 납득이 되어야 다음 단계로 갈 수 있습니다.

> 점수 해석에 주의하세요. **스토어마다 점수의 의미가 다릅니다.**
> Pinecone의 코사인 점수는 클수록 유사하고, FAISS의 기본 점수는 L2 거리라 **작을수록 유사**합니다.
> 절대값에 의미를 두지 말고, 같은 조건에서의 **상대 비교**로만 쓰세요.

## 7. 정리

- 임베딩은 텍스트를 벡터로 바꾸고, 의미가 비슷하면 벡터가 가까워진다.
- 유사도는 코사인 유사도로 재고, 벡터 스토어가 상위 k개를 빠르게 찾아 준다.
- **인제스트와 질의의 임베딩 모델은 반드시 같아야 한다.** 설정을 한 곳에 모아 두자.
- 시작은 FAISS, 운영은 pgvector나 Pinecone. 인터페이스가 비슷해 이전이 쉽다.
- 청크 ID를 결정적으로 만들어 중복 인제스트를 막고, 문서 삭제 경로도 미리 준비한다.
- LLM을 붙이기 전에 **검색 결과부터 눈으로 검수**한다.

## 실습

1. 서로 다른 표현의 같은 뜻 문장 세 쌍을 만들어 코사인 유사도를 계산해 보세요.
2. 인덱스를 만든 뒤 `similarity_search_with_score`로 다섯 개 질문을 던져 보고, 만족스럽지 않은 질문을 기록해 두세요. 다음 편에서 그 질문들로 검색을 개선합니다.
3. 같은 PDF를 두 번 인제스트해 보고, 결정적 ID를 적용한 경우와 아닌 경우의 검색 결과를 비교해 보세요.

다음 편은 **리트리버**입니다. 검색 품질이 답변의 상한선이라는 말을 코드로 확인합니다.
