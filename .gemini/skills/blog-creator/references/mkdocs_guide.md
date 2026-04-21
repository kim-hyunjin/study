# MkDocs Integration Guide

이 가이드는 `blog-creator` 스킬을 통해 생성된 포스트를 MkDocs 사이트에 어떻게 통합하는지 설명합니다.

## 1. 포스트 저장 및 관리
- **경로:** 모든 블로그 포스트는 원본 파일(소스 코드, 학습 노트 등)이 포함된 **프로젝트 폴더 내**에 저장합니다.
- **파일명 규칙:** 해당 프로젝트의 맥락을 알 수 있는 이름을 사용하며, 가급적 `post.md` 또는 `README_blog.md`와 같은 명확한 이름을 권장합니다.
- **장점:** 프로젝트 코드와 문서(블로그 포스트)가 같은 위치에 있어 관리가 용이하고, MkDocs의 상대 경로 참조가 쉬워집니다.

## 2. mkdocs.yml 업데이트
포스트를 작성한 후에는 `mkdocs.yml`의 `nav` 섹션 중 해당 프로젝트 위치에 포스트를 등록합니다.

### 예시: nav 구조에 프로젝트 하위 포스트 추가
```yaml
nav:
  - Backend:
      - MSA:
          - Overview: backend/msa/README.md
          - "MSA 아키텍처 깊이 파기 (Post)": backend/msa/post.md
```

## 3. MkDocs-Material 블로그 기능 (고급)
만약 `mkdocs-material`의 공식 블로그 플러그인을 사용하고 싶다면, `mkdocs.yml`에 다음 설정을 추가할 수 있습니다:

```yaml
plugins:
  - blog:
      post_readtime: true
      post_excerpt: true
```

이 플러그인을 활성화하면 `blog/` 폴더 내의 파일들이 날짜순으로 자동 나열되며 별도의 `nav` 등록이 필요하지 않을 수도 있습니다. 현재 워크스페이스는 수동 `nav` 관리를 선호하는 구조이므로, 포스트 추가 시 `nav` 업데이트를 먼저 제안하십시오.
