---
title: "Elixir 입문 가이드"
description: "병렬성과 유지보수성이 뛰어난 함수형 언어 Elixir의 핵심 개념인 불변성, 패턴 매칭, 파이프 연산자 요약"
date: 2026-04-22
categories:
  - Language
  - Elixir
tags:
  - Elixir
  - FunctionalProgramming
  - ErlangBEAM
  - PipeOperator
  - Mix
---

# Elixir 입문 가이드

## 🚀 개요
Elixir는 Erlang 가상 머신(BEAM) 위에서 동작하는 동적 함수형 언어로, 높은 가용성과 확장성을 가진 애플리케이션을 구축하기 위해 설계되었습니다. 본 문서는 Elixir의 기초 문법과 함수형 프로그래밍의 핵심 개념들을 정리한 가이드입니다.

---

## 💡 1. 함수형 프로그래밍의 기초

### 불변성 (Immutability)
- Elixir의 모든 데이터는 불변입니다. 값을 수정하는 대신 새로운 데이터를 생성합니다.
- 복잡한 상태 변화를 추적하기 쉬워지며, 병렬 프로그래밍에서 데이터 경합 문제를 원천적으로 차단합니다.

### 패턴 매칭 (Pattern Matching)
- `=` 연산자는 할당이 아닌 **매치(Match)** 연산자입니다. 좌변과 우변의 구조를 비교하고 변수를 바인딩합니다.
  ```elixir
  {status, message} = {:ok, "Success"}
  # status -> :ok, message -> "Success"
  ```

---

## 🛠️ 2. Elixir만의 강력한 기능

### 파이프 연산자 (`|>`)
- 함수의 실행 결과를 다음 함수의 첫 번째 인자로 전달합니다. 코드의 가독성을 획기적으로 높여줍니다.
  ```elixir
  "hello world"
  |> String.upcase()
  |> String.split()
  # ["HELLO", "WORLD"]
  ```

### 모듈과 함수 (Modules & Functions)
- `defmodule`로 모듈을 정의하고, `def`로 공용 함수를, `defp`로 비공개 함수를 선언합니다.
- **가드 (Guards):** `when` 키워드를 사용하여 함수 호출 시 인자의 타입을 제한할 수 있습니다.
  ```elixir
  def anagrams?(a, b) when is_binary(a) and is_binary(b) do
    sort_string(a) == sort_string(b)
  end
  ```

---

## 🏗️ 3. 생태계 및 도구

### Mix (빌드 도구)
- 프로젝트 생성, 의존성 관리, 컴파일, 테스트 실행 등을 담당하는 강력한 도구입니다.
- `mix new project_name`으로 새 프로젝트를 시작할 수 있습니다.

### IEx (대화형 쉘)
- `iex -S mix` 명령을 통해 프로젝트 문맥 내에서 실시간으로 코드를 실행하고 테스트할 수 있습니다.

---

## 📝 배운 점 및 결론
- **선언적 코드:** 파이프 연산자와 패턴 매칭을 통해 '어떻게'가 아닌 '무엇을' 하는지에 집중하는 명확한 코드를 작성할 수 있습니다.
- **확장성:** BEAM 엔진의 경량 프로세스 모델을 통해 수백만 개의 동시 프로세스를 효율적으로 관리할 수 있는 잠재력을 확인했습니다.
- **문서화:** `@moduledoc`과 `@doc`을 통해 코드 내에서 풍부한 문서를 작성하고, 이를 `ExDoc`을 통해 웹 페이지로 쉽게 생성할 수 있습니다.

---
*상세 실습 코드는 `example/lib` 하위의 `anagram.ex`, `greeter.ex` 등을 참고하세요.*
