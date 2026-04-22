---
title: "Next.js 블로그 구축 튜토리얼: SSR과 SSG의 이해"
description: "Next.js 공식 튜토리얼을 통해 학습한 정적 사이트 생성(SSG), 서버 사이드 렌더링(SSR), 동적 라우팅 및 데이터 페칭 전략 요약"
date: 2026-04-22
categories:
  - Frontend
  - Nextjs
tags:
  - Nextjs
  - React
  - SSG
  - SSR
  - DynamicRoutes
  - Vercel
---

# Next.js 블로그 구축 튜토리얼: SSR과 SSG의 이해

## 🚀 개요
Next.js는 React 기반의 프레임워크로, 정적 사이트 생성(SSG)과 서버 사이드 렌더링(SSR)을 완벽하게 지원합니다. 본 문서는 Next.js 공식 튜토리얼을 진행하며 학습한 핵심 개념과 블로그 구축 과정을 정리한 가이드입니다.

---

## 💡 1. 렌더링 전략: SSG vs SSR

Next.js의 가장 강력한 기능인 두 가지 사전 렌더링(Pre-rendering) 방식을 학습했습니다.

### 정적 사이트 생성 (Static Generation, SSG)
- **개념:** 빌드 시점에 HTML을 생성하고 각 요청마다 재사용합니다.
- **활용:** 블로그 포스트처럼 내용이 자주 바뀌지 않는 페이지에 적합합니다.
- **함수:** `getStaticProps` (데이터 페칭), `getStaticPaths` (동적 라우팅 경로 생성).

### 서버 사이드 렌더링 (Server-side Rendering, SSR)
- **개념:** 매 요청마다 서버에서 HTML을 생성합니다.
- **활용:** 항상 최신 데이터를 보여줘야 하는 페이지에 적합합니다.
- **함수:** `getServerSideProps`.

---

## 🛠️ 2. 핵심 기능 실습

### 동적 라우팅 (Dynamic Routes)
- 파일 이름을 `[id].tsx`와 같이 대괄호로 감싸서 동적 경로를 생성합니다.
- `getStaticPaths`를 통해 빌드 시 생성할 경로 목록을 정의합니다.

### 데이터 페칭 및 처리
- 외부 마크다운 파일을 읽어 HTML로 변환하는 과정을 라이브러리(`remark`, `gray-matter`)와 함께 구현했습니다.
- `lib/posts.ts` 파일을 통해 데이터 로직을 분리하여 관리하는 패턴을 익혔습니다.

### Assets, Metadata, and CSS
- **Image Component:** 이미지 최적화 및 레이지 로딩 처리.
- **Head Component:** SEO를 위한 메타데이터 관리.
- **CSS Modules:** 컴포넌트 단위의 스타일링과 클래스 이름 충돌 방지.

---

## 🌐 3. 배포 및 운영

- **Vercel:** Next.js 개발사가 만든 클라우드 플랫폼을 통해 GitHub 연동 및 자동 배포를 실습했습니다.
- **API Routes:** API 엔드포인트를 직접 구축하여 서버리스 함수처럼 활용하는 방법을 익혔습니다.

---

## 📝 배운 점 및 결론
- **성능과 SEO:** 사전 렌더링을 통해 사용자 경험을 높이고 검색 엔진 최적화를 동시에 달성할 수 있음을 확인했습니다.
- **개발 생산성:** 복잡한 설정 없이 라우팅, 최적화, 배포가 이루어지는 Next.js의 편리함을 체감했습니다.
- **하이브리드 전략:** 페이지별로 SSG와 SSR을 선택적으로 적용할 수 있는 유연성이 Next.js의 큰 장점임을 이해했습니다.

---
*상세 구현 코드는 `pages/`, `lib/`, `posts/` 디렉토리를 참고하세요.*
