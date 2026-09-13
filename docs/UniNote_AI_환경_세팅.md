# UniNote AI 개발 환경 구성

## 1. 한 줄 요약

**`AGENTS.md` = AI 개발 규칙 / `PLANS.md` = 현재 작업 계획 / `docs/` = 프로젝트 지식**

권장 AI 개발 흐름:

**Codex 분석·계획 → Claude Code 구현·테스트 → Codex 결과 검토**

---

## 2. 프로젝트 구조

```text
capstone/
│
├─ AGENTS.md
├─ PLANS.md
│
├─ docs/
│  ├─ architecture.md
│  ├─ api.md
│  ├─ database.md
│  └─ development-status.md
│
├─ backend/
├─ frontend/
└─ ...
```

---

## 3. 각 파일의 역할

| 파일 | 역할 |
|---|---|
| `AGENTS.md` | AI가 반드시 지켜야 할 공통 개발 규칙 |
| `PLANS.md` | 현재 진행할 작업의 계획과 진행 상태 |
| `docs/architecture.md` | 전체 시스템 구조 |
| `docs/api.md` | API 목록과 요청·응답 형식 |
| `docs/database.md` | DB, Entity, 테이블 및 관계 |
| `docs/development-status.md` | 구현 완료 / 진행 중 / 예정 기능 |

### 핵심 원칙

- `AGENTS.md`는 짧게 유지한다.
- 상세한 프로젝트 지식은 `docs/`에 둔다.
- 현재 작업 내용은 `PLANS.md`에 둔다.
- 구현되지 않은 기능을 이미 존재한다고 가정하지 않는다.
- 실제 코드와 문서가 다르면 실제 코드와 설정을 먼저 확인한다.

---

# 4. AGENTS.md

## 목적

AI가 UniNote에서 작업할 때 **어떻게 작업해야 하는지** 정의한다.

### 포함할 내용

- 기존 코드 우선 분석
- 필요한 범위만 수정
- 기존 구조 및 기능 유지
- 불필요한 라이브러리·추상화 추가 금지
- 작업 전 `git status` 확인
- 구현 후 빌드·테스트·동작 확인
- 보안 규칙
- Backend / Frontend 기본 규칙

### 넣지 않는 것이 좋은 내용

- 긴 프로젝트 소개
- 모든 API의 상세 설명
- 모든 DB 테이블 설명
- 현재 작업의 세부 계획
- 구현 예정 기능의 긴 설명

이런 내용은 `docs/` 또는 `PLANS.md`로 분리한다.

---

# 5. PLANS.md

## 목적

AI에게 **현재 무엇을 구현할지** 알려주는 작업 계획이다.

예:

```md
# UniNote 개발 계획

## 현재 작업

Tiptap 노트 기반 AI 질문 생성

## 목표

사용자가 작성한 노트를 AI가 분석하여
학습용 질문을 생성한다.

## 작업 단계

1. 현재 Note 구조 확인
2. Tiptap JSON에서 분석할 텍스트 추출
3. AI 연동
4. 질문 생성 프롬프트 작성
5. AI 응답 검증
6. 질문 생성 API 구현
7. React에서 결과 표시
8. 테스트

## 검증

- 일반 텍스트 노트
- 이미지가 포함된 노트
- 빈 노트
- AI API 오류
```

작업하면서:

```md
- [x] 완료
- [ ] 미완료
```

형태로 진행 상태를 관리한다.

---

# 6. docs/

`docs/`는 AI가 프로젝트를 이해하는 데 필요한 **상세 지식 저장소**이다.

## architecture.md

시스템 구조와 주요 컴포넌트 관계를 기록한다.

예:

```text
React
 ↓
Axios
 ↓
Spring Controller
 ↓
Service
 ↓
Repository
 ↓
MySQL
```

## api.md

API의 URL, HTTP Method, Request, Response 등을 기록한다.

예:

```md
## 로그인

POST /api/auth/login

Request:
{
  "studentNum": "...",
  "password": "..."
}

Response:
{
  "token": "...",
  "studentNum": "..."
}
```

## database.md

Entity, 테이블, 컬럼 및 관계를 기록한다.

예:

```text
Student
 └─ Enrollment
      └─ Course
           └─ Note
```

## development-status.md

현재 프로젝트 상태를 기록한다.

예:

```md
# 개발 현황

## 완료

- 로그인
- JWT 인증
- 과목 대시보드
- 과목 상세
- 게시판
- Tiptap 노트
- 노트 자동 저장

## 진행 중

- AI 질문 생성

## 예정

- AI 요약
- 학습 결과 저장
- 퀴즈 기록
```

---

# 7. AI별 역할

## Codex

### 주 역할
**프로젝트 분석 + 요구사항 분석 + 작업 계획 수립 + 코드 구조 검토 + 문제 원인 분석 + 구현 방향 제시 + 작업 결과 검토**

```text
프로젝트 및 코드 구조 분석
 ↓
요구사항 및 영향 범위 분석
 ↓
문제 원인 분석
 ↓
구현 방향 및 작업 계획 수립
 ↓
작업 결과 검토 및 필요한 수정 사항 제시
```

구현 전에 프로젝트와 요구사항을 분석하고, 작업 계획과 구현 방향을 제시한다. 구현이 완료된 후에는 결과를 검토하고 필요한 후속 수정 사항을 제시한다.

---

## Claude Code

### 주 역할
**실제 코드 작성 + 코드 수정 + 기능 구현 + 디버깅 + 테스트 + 리팩터링**

```text
PLANS.md 확인
 ↓
Backend / Frontend 코드 작성 및 수정
 ↓
기능 구현
 ↓
디버깅 및 리팩터링
 ↓
빌드 / 테스트
```

Codex가 수립한 계획과 구현 방향을 바탕으로 실제 코드를 변경하고, 기능 구현·디버깅·테스트·리팩터링을 담당한다.

---

---

# 8. 권장 AI 개발 루프

예를 들어 AI 질문 생성 기능을 만든다면:

### Step 1 — Codex

```text
프로젝트 및 코드 구조 분석
↓
요구사항 분석
↓
문제 원인 및 영향 범위 확인
↓
구현 방향 제시
↓
작업 계획 수립 및 PLANS.md 작성
```

### Step 2 — Claude Code

```text
PLANS.md 확인
↓
Backend / Frontend 코드 작성 및 수정
↓
기능 구현
↓
디버깅 및 리팩터링
↓
빌드 / 테스트
```

### Step 3 — Codex

```text
구현 결과 및 변경사항 검토
↓
요구사항 충족 여부 확인
↓
문제점 및 원인 분석
↓
필요한 수정 사항과 후속 구현 방향 제시
```

Codex는 분석·계획·검토를 담당하고, Claude Code는 계획에 따른 실제 구현과 테스트를 담당한다. 동일한 작업을 중복하지 않도록 Codex는 직접 구현하기보다 구현 방향과 검토 결과를 제시하며, Claude Code는 별도의 분석 계획을 다시 수립하지 않고 정해진 계획을 실행한다.

---

# 9. 토큰을 효율적으로 사용하는 방법

AI에게 프로젝트 설명을 매번 직접 입력하지 않는다.

```text
AGENTS.md
   ↓
공통 규칙

docs/
   ↓
상세 프로젝트 정보

PLANS.md
   ↓
현재 작업
```

AI가 필요한 정보를 문서에서 확인하도록 한다.

## 피해야 할 구조

```text
AGENTS.md 500줄
PLANS.md 300줄
```

문서가 지나치게 길면 AI가 불필요한 정보를 읽어야 하므로 효율이 떨어질 수 있다.

## 권장

**짧은 규칙 + 필요한 상세 문서 + 현재 작업 계획**

---

# 10. 처음 세팅할 때의 우선순위

처음부터 모든 문서를 만들 필요는 없다.

### 1단계

```text
AGENTS.md
```

공통 개발 규칙 확정

### 2단계

```text
PLANS.md
```

현재 작업 계획 작성

### 3단계

```text
docs/development-status.md
```

구현 완료 / 진행 중 / 예정 구분

### 4단계

필요해질 때 추가:

```text
docs/
├─ architecture.md
├─ api.md
└─ database.md
```

---

# 11. 최종 구조

```text
                 UniNote
                    │
        ┌───────────┴───────────┐
        │                       │
    개발 규칙                프로젝트 지식
        │                       │
   AGENTS.md                  docs/
        │                       │
        │             ┌─────────┼─────────┐
        │             │         │         │
        │        architecture  api    database
        │
        └────── 현재 작업 ──────┐
                                │
                            PLANS.md
                                │
                       AI가 실제 작업 수행
```

## 핵심 정리

- **AGENTS.md** → AI가 지켜야 하는 규칙
- **PLANS.md** → 현재 작업 계획
- **docs/** → 상세 프로젝트 지식
- **Codex** → 프로젝트·요구사항 분석, 계획 수립, 구조 검토, 원인 분석, 구현 방향 제시, 결과 검토
- **Claude Code** → 계획에 따른 코드 작성·수정, 기능 구현, 디버깅, 테스트, 리팩터링
