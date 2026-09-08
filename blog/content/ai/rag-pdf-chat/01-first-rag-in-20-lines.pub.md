---
title: "[RAG 01] 20줄로 만드는 첫 RAG"
date: 2026-09-08
category: "AI"
categories:
  - "AI"
  - "LLM"
tags:
  - "RAG"
  - "LangChain"
  - "FAISS"
  - "Python"
summary: "Python 환경 설정부터 시작해 PDF 한 개에 질문하는 RAG를 파일 하나로 완성합니다. Load-Split-Embed-Store-Retrieve-Generate 6단계를 코드로 확인합니다."
---

이론은 뒤로 미루고, 일단 **돌아가는 RAG**를 만들어 봅니다.
이번 편이 끝나면 PDF 하나에 대해 질문하고 답을 받는 스크립트가 손에 남습니다.
길이는 주석 빼고 20여 줄입니다.

## 준비물

- Python 3.10 이상
- OpenAI API 키 ([platform.openai.com](https://platform.openai.com)에서 발급)
- 질문할 PDF 파일 하나

> 임베딩과 답변 생성 모두 유료 API를 호출합니다. 논문 한 편(10~20페이지) 정도라면 실습 비용은
> 아주 적지만, 처음에는 **작은 PDF로 시작**하고 대시보드에서 사용량을 한 번 확인해 보세요.
> 사용량 한도(usage limit)를 걸어 두면 마음이 편합니다.

## 1. 프로젝트 만들기

```bash
mkdir my-rag && cd my-rag
python -m venv .venv

# macOS / Linux
source .venv/bin/activate
# Windows
.\.venv\Scripts\activate
```

가상 환경(venv)은 이 프로젝트에서만 쓸 패키지를 별도 폴더에 격리해 두는 장치입니다.
프롬프트 앞에 `(.venv)`가 붙으면 활성화된 것입니다.

```bash
pip install langchain langchain-openai langchain-community \
            langchain-text-splitters faiss-cpu pypdf python-dotenv
```

각 패키지의 역할입니다.

| 패키지 | 역할 |
|--------|------|
| `langchain` | 체인 조립 함수들 (`create_retrieval_chain` 등) |
| `langchain-openai` | OpenAI 임베딩·챗 모델 연결 |
| `langchain-community` | 로더·벡터 스토어 등 커뮤니티 연동 모음 |
| `langchain-text-splitters` | 텍스트 분할기 |
| `faiss-cpu` | 로컬에서 도는 벡터 검색 엔진 (Meta의 FAISS) |
| `pypdf` | PDF에서 텍스트 추출 |
| `python-dotenv` | `.env` 파일에서 환경 변수 읽기 |

## 2. API 키 설정

프로젝트 폴더에 `.env` 파일을 만듭니다.

```bash
OPENAI_API_KEY=sk-...
```

```bash
echo ".env" >> .gitignore
echo ".venv/" >> .gitignore
```

**키를 코드에 직접 쓰지 마세요.** 실수로 커밋하면 즉시 폐기하고 새로 발급받아야 합니다.
`.gitignore`부터 만들어 두는 습관이 안전합니다.

## 3. PDF 준비

아무 PDF나 좋지만, **텍스트가 선택되는 PDF**여야 합니다.
스캔한 이미지 PDF는 텍스트 추출이 되지 않아 나중에 "왜 아무것도 못 찾지?"의 원인이 됩니다(10편).

미리 확인하는 방법은 간단합니다.

```python
from langchain_community.document_loaders import PyPDFLoader

pages = PyPDFLoader("paper.pdf").load()
print(len(pages))                 # 페이지 수
print(pages[0].page_content[:300])  # 첫 페이지 앞부분
```

여기서 빈 문자열이 나오면 그 PDF는 OCR이 필요합니다. 다른 PDF로 바꿔서 진행하세요.

## 4. 전체 코드

`main.py`:

```python
import os
from dotenv import load_dotenv

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains.retrieval import create_retrieval_chain

load_dotenv()
PDF_PATH = "paper.pdf"
INDEX_DIR = "faiss_index"

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# ── ① 인제스트: 최초 1회만 ────────────────────────────────
if not os.path.exists(INDEX_DIR):
    docs = PyPDFLoader(PDF_PATH).load()                      # 1) Load
    chunks = RecursiveCharacterTextSplitter(
        chunk_size=1000, chunk_overlap=150
    ).split_documents(docs)                                  # 2) Split
    store = FAISS.from_documents(chunks, embeddings)         # 3) Embed + 4) Store
    store.save_local(INDEX_DIR)
    print(f"{len(docs)}페이지 → {len(chunks)}청크 인덱싱 완료")
else:
    store = FAISS.load_local(
        INDEX_DIR, embeddings, allow_dangerous_deserialization=True
    )

# ── ② 질의: 물어볼 때마다 ────────────────────────────────
retriever = store.as_retriever(search_kwargs={"k": 4})       # 5) Retrieve

prompt = ChatPromptTemplate.from_template(
    """당신은 문서 질의응답 도우미입니다.
아래 <context>의 내용만 근거로 한국어로 답하세요.
context에 답이 없으면 "문서에서 찾을 수 없습니다"라고 답하세요.

<context>
{context}
</context>

질문: {input}"""
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
chain = create_retrieval_chain(
    retriever,
    create_stuff_documents_chain(llm, prompt),               # 6) Generate
)

result = chain.invoke({"input": "이 문서의 핵심 주장을 3문장으로 요약해줘"})
print(result["answer"])
```

```bash
python main.py
```

이게 전부입니다. RAG의 6단계가 한 파일에 다 들어 있습니다.

## 5. 코드 한 줄씩 읽기

### Load — PDF에서 텍스트 꺼내기

```python
docs = PyPDFLoader(PDF_PATH).load()
```

`load()`는 **페이지 하나당 `Document` 하나**를 만들어 리스트로 돌려줍니다.
`Document`는 LangChain에서 문서 조각을 표현하는 기본 타입으로, 필드가 두 개뿐입니다.

```python
doc.page_content  # 텍스트 (str)
doc.metadata      # 부가 정보 (dict) — PyPDFLoader는 source, page를 넣어 줍니다
```

### Split — 검색하기 좋은 크기로 자르기

```python
chunks = RecursiveCharacterTextSplitter(
    chunk_size=1000, chunk_overlap=150
).split_documents(docs)
```

페이지 단위는 검색에 너무 큽니다. 한 페이지에 여러 주제가 섞여 있으면
그 페이지 전체가 "관련 있음"으로 뽑히면서 노이즈가 함께 들어옵니다.
그래서 1000자 정도로 자르고, 경계에서 문장이 잘려 나가지 않도록 150자를 겹쳐 둡니다.
왜 이 값인지는 2편에서 자세히 다룹니다.

### Embed + Store — 벡터로 바꿔 저장

```python
store = FAISS.from_documents(chunks, embeddings)
store.save_local(INDEX_DIR)
```

`from_documents`는 청크들을 한꺼번에 임베딩 API에 보내 벡터로 만들고, FAISS 인덱스에 담습니다.
`save_local`로 디스크에 저장해 두면 다음 실행부터는 임베딩 비용을 다시 낼 필요가 없습니다.
위 코드에서 `if not os.path.exists(INDEX_DIR)` 로 감싼 이유가 이것입니다.

> `load_local`의 `allow_dangerous_deserialization=True`가 필요한 이유:
> FAISS 인덱스 파일은 pickle로 저장되고, pickle 역직렬화는 임의 코드 실행이 가능합니다.
> LangChain이 안전장치로 명시적 동의를 요구합니다. **내가 만든 인덱스**에만 쓰세요.
> 남이 준 인덱스 파일을 이 옵션으로 불러오는 것은 실행 파일을 받아서 실행하는 것과 같습니다.

### Retrieve — 관련 청크 가져오기

```python
retriever = store.as_retriever(search_kwargs={"k": 4})
```

`k=4`는 "가장 비슷한 청크 4개를 가져와라"입니다. 이 숫자가 답변 품질에 얼마나 크게
작용하는지는 4편에서 다룹니다.

### Generate — 프롬프트에 넣고 LLM 호출

```python
create_stuff_documents_chain(llm, prompt)
```

"stuff"는 **검색된 문서를 프롬프트에 그대로 채워 넣는다**는 뜻입니다.
이 체인이 `{context}` 자리에 청크 4개의 본문을 이어 붙여 넣고 LLM을 호출합니다.
`create_retrieval_chain`은 그 앞에 리트리버를 연결해 "질문 → 검색 → 생성"을 하나로 묶습니다.

```python
result = chain.invoke({"input": "..."})
result["answer"]   # 최종 답변 문자열
result["context"]  # 실제로 사용된 Document 리스트
result["input"]    # 원래 질문
```

`temperature=0`은 **매번 같은 입력에 같은 답**이 나오도록 무작위성을 최소화하는 설정입니다.
창작이 아니라 문서 기반 답변이므로 0에 가깝게 두는 편이 좋습니다.

## 6. 가장 중요한 디버깅 습관

RAG가 이상한 답을 하면 **LLM을 의심하기 전에 검색 결과부터 눈으로 봅니다.**

```python
for i, doc in enumerate(retriever.invoke("이 문서의 핵심 주장은?"), start=1):
    print(f"--- [{i}] page={doc.metadata.get('page')} ---")
    print(doc.page_content[:200].replace("\n", " "))
    print()
```

여기서 나오는 조각들이 **사람이 봐도 질문과 관련 없어 보인다면**, 프롬프트를 고쳐도 소용없습니다.
청킹(2편)이나 검색 설정(4편)을 손봐야 합니다.
반대로 조각은 멀쩡한데 답이 엉뚱하다면 프롬프트 문제(5편)입니다.

이 두 가지를 구분하는 것만으로 RAG 디버깅의 대부분이 정리됩니다.

## 7. 답변에 출처 붙이기

이미 `result["context"]`에 근거 문서가 들어 있으니, 몇 페이지를 참고했는지 바로 보여 줄 수 있습니다.

```python
result = chain.invoke({"input": "이 문서의 핵심 주장을 3문장으로 요약해줘"})
print(result["answer"])

pages = sorted({doc.metadata.get("page", 0) + 1 for doc in result["context"]})
print("\n참고한 페이지:", ", ".join(map(str, pages)))
```

`PyPDFLoader`의 `page`는 0부터 시작하므로 사람이 읽을 때는 1을 더합니다.
출처 표시는 "그럴듯하지만 틀린 답"을 사용자가 직접 검증할 수 있게 해 주는,
비용 대비 효과가 가장 좋은 기능 중 하나입니다.

## 8. `pdf-app`은 이 코드를 어떻게 키웠나

방금 만든 스크립트와 실제 앱의 차이는 이렇습니다. 각 항목은 해당 편에서 하나씩 붙입니다.

| 스크립트 | pdf-app | 편 |
|---------|---------|----|
| FAISS 로컬 파일 | Pinecone (관리형 벡터 DB) | 3편 |
| PDF 한 개 고정 | 업로드된 여러 PDF, `pdf_id` 필터 | 4편 |
| 단발 질문 | 대화 기록 + 질문 압축 | 6편 |
| 답변 한 번에 출력 | 토큰 스트리밍 (SSE) | 7편 |
| 스크립트 실행 시 인제스트 | Celery 워커가 비동기 처리 | 8편 |
| 설정값 고정 | 컴포넌트 조합 실험 + 사용자 평가 | 9편 |

**중요한 것은 순서입니다.** 처음부터 Pinecone과 Celery를 붙이면 어디가 잘못됐는지 알 수 없습니다.
FAISS + 스크립트로 "검색이 제대로 되는가"를 먼저 확인하고, 그다음에 서비스로 키우는 것이 훨씬 빠릅니다.

## 실습

1. `k`를 1, 4, 10으로 바꿔 가며 같은 질문을 던지고 답변이 어떻게 달라지는지 비교해 보세요.
2. 문서에 **없는 내용**을 물어보세요. 프롬프트의 "찾을 수 없습니다" 지시가 실제로 지켜지나요?
3. 프롬프트에서 `context에 답이 없으면...` 문장을 지우고 같은 질문을 해 보세요. 무엇이 달라지나요?

다음 편에서는 이 코드에서 대충 넘어간 **로드와 청킹**을 제대로 파고듭니다.
`chunk_size=1000`이 왜 1000인지, 표와 코드가 든 문서는 어떻게 다뤄야 하는지 알아봅니다.
