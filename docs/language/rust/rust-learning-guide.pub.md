---
title: "Rust 기초 학습 가이드"
description: "Rust 프로그래밍 언어의 핵심 개념인 가변성, 섀도잉, 데이터 타입(Scalar, Compound), 구조체 및 컬렉션 요약"
date: 2026-04-22
categories:
  - Language
  - Rust
tags:
  - Rust
  - Ownership
  - MemorySafety
  - Struct
  - Collections
---

# Rust 기초 학습 가이드

## 🚀 개요
Rust는 메모리 안전성, 속도, 병렬성을 동시에 추구하는 시스템 프로그래밍 언어입니다. 본 문서는 Rust의 기초 문법과 핵심 개념들을 실습 코드와 함께 정리한 가이드입니다.

---

## 💡 1. 변수와 가변성 (Variables & Mutability)

### 가변성 (Mutability)
- Rust의 변수는 기본적으로 **불변(Immutable)**입니다.
- 값을 변경하려면 `mut` 키워드를 명시해야 합니다.
  ```rust
  let mut x = 5;
  x = 6; // 가능
  ```

### 섀도잉 (Shadowing)
- 이전 변수와 같은 이름으로 새 변수를 선언하여 기존 바인딩을 덮어쓰는 기능입니다.
- 타입 변환이 필요할 때 유용하게 사용됩니다.
  ```rust
  let spaces = "   ";
  let spaces = spaces.len(); // 문자열에서 숫자로 타입 변경 가능
  ```

---

## 🏗️ 2. 데이터 타입 (Data Types)

### 스칼라 타입 (Scalar Types)
- **정수:** `i32`, `u64`, `isize` 등 (기본은 `i32`)
- **부동 소수점:** `f32`, `f64` (기본은 `f64`)
- **불리언:** `bool` (`true`, `false`)
- **문자:** `char` (4바이트 유니코드)

### 복합 타입 (Compound Types)
- **튜플 (Tuple):** 서로 다른 타입의 값들을 하나로 묶음. 고정된 길이를 가집니다.
  ```rust
  let tup: (i32, f64, u8) = (500, 6.4, 1);
  let (x, y, z) = tup; // 구조 분해
  println!("{}", tup.0); // 인덱스로 접근
  ```
- **배열 (Array):** 동일한 타입의 값들을 묶음. 고정된 길이를 가지며 스택에 할당됩니다.
  ```rust
  let a = [1, 2, 3, 4, 5];
  let b = [0; 5]; // [0, 0, 0, 0, 0]
  ```

---

## 🏛️ 3. 구조체와 열거형 (Structs & Enums)

### 구조체 (Structs)
- **Classic Struct:** 이름이 있는 필드로 구성됩니다.
- **Tuple Struct:** 필드 이름 없이 타입만 정의합니다.
- **Unit Struct:** 필드가 없는 구조체입니다.
  ```rust
  struct Person { name: String, age: u8 }
  struct Color(i32, i32, i32);
  struct AlwaysAlive;
  ```

### 열거형 (Enums)
- 데이터와 함께 상태를 표현할 수 있습니다.
  ```rust
  enum WebEvent {
      PageLoad,
      KeyPress(char),
      Click { x: i64, y: i64 },
  }
  ```

---

## 📂 4. 공통 컬렉션 (Common Collections)

### 벡터 (Vector)
- 런타임에 크기가 변할 수 있는 동적 배열입니다. 힙에 데이터를 저장합니다.
  ```rust
  let mut v = vec![1, 2, 3];
  v.push(4);
  ```

### 해시 맵 (Hash Map)
- 키-값 쌍을 저장하는 컬렉션입니다.
  ```rust
  use std::collections::HashMap;
  let mut scores = HashMap::new();
  scores.insert(String::from("Blue"), 10);
  ```

---

## 📝 배운 점 및 결론
- **강력한 컴파일러:** Rust의 컴파일러는 메모리 오류와 데이터 경합을 사전에 차단하여 런타임 안정성을 보장합니다.
- **표현력:** `if` 문이나 `loop` 문이 식으로 동작하여 값을 반환할 수 있는 등 현대적인 문법을 갖추고 있습니다.
- **도구 생태계:** `Cargo`를 통해 빌드, 패키지 관리, 테스트를 매우 편리하게 수행할 수 있습니다.

---
*상세 실습 코드는 `main.rs`, `structPractice.rs`, `collection.rs` 등을 참고하세요.*
