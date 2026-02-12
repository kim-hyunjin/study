# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal learning archive (학습 내용 저장소) containing study materials, practice projects, and course exercises across multiple languages and frameworks. It is **not** a single application — each subdirectory is an independent project with its own build system.

## Top-Level Structure

- **ai/** — Deep learning from scratch (numpy), LangChain projects (vector DBs, PDF apps, React integration)
- **algorithms/** — Problem solving in Java, Python, JS, Go; LeetCode and Grind 75 solutions
- **backend/** — Django, Go, Node.js (GraphQL, WebRTC zoom clone), NestJS (Slack clone), Spring Boot, Rails, MSA with Spring Cloud (9 microservices), performance testing with Artillery
- **blockchain/** — Web3 dApps, Solidity smart contracts, Klaytn integration
- **design-architecture/** — Design patterns, OOAD
- **frontend/** — React (11+ projects), Next.js (7 projects), Vue.js (6 projects), Webpack config
- **language/** — Go, Java (LMS app with 30 versions), JavaScript, TypeScript, Rust, Kotlin, Elixir fundamentals
- **mobile/** — Android (20+ projects), iOS, React Native (10+ projects), Flutter (8 projects)

## Build Systems by Language

Each sub-project is self-contained. Use the build tool matching the project:

| Language | Build Tool | Run Commands |
|----------|-----------|-------------|
| Java | Gradle (`build.gradle`) | `./gradlew build`, `./gradlew test`, `./gradlew bootRun` (Spring) |
| Java | Maven (`pom.xml`) | `mvn package`, `mvn test`, `mvn spring-boot:run` |
| JS/TS | npm (`package.json`) | `npm install`, `npm start`, `npm test`, `npm run dev` |
| Python | pip (`requirements.txt`) | `pip install -r requirements.txt`, `python manage.py runserver` (Django) |
| Go | Go modules (`go.mod`) | `go build`, `go test ./...`, `go run .` |
| Rust | Cargo (`Cargo.toml`) | `cargo build`, `cargo test`, `cargo run` |
| Flutter | Flutter SDK | `flutter pub get`, `flutter run` |
| Android | Gradle | `./gradlew assembleDebug` |

Always check the specific sub-project's README or config files before running commands — many projects have unique scripts defined in their `package.json` or build files.

## Key Architectural Notes

- **MSA project** (`backend/spring/msa/`): 9 Spring Cloud microservices with Config Server, Discovery (Eureka), API Gateway, Zuul routing, and Prometheus monitoring
- **Zoom clone** (`backend/nodejs/zoom-clone/`): Three separate implementations — Socket.IO, WebRTC, and raw WebSocket — for comparison
- **Java LMS** (`language/java/lms-app/`): 30 progressive versions showing incremental feature development
- **React blog** (`frontend/react/react-master/blog/`): Full-stack with Koa backend and MongoDB
- **LangChain projects** (`ai/langchain/`): Python backends with React frontends; use virtual environments

## Language Distribution

The repository is heavily weighted toward Java (~5,900 files) and JavaScript/TypeScript (~700+ files), with smaller portions in Python, Go, Kotlin, Rust, and Elixir.
