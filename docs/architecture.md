# UniNote 아키텍처

## 전체 구조

UniNote는 React/Vite 프론트엔드와 Spring Boot 백엔드가 REST API로 통신하는 웹 애플리케이션이다.

```text
React pages/components
  -> Context 및 Axios client
  -> Spring Security / JWT filter
  -> Controller
  -> Service
  -> Spring Data JPA Repository
  -> MySQL
```

## Backend

- `controller`: HTTP 요청과 DTO를 받아 Service를 호출한다.
- `service`: 인증된 사용자 기준의 기능 처리, 수강 권한 확인, 엔티티 조회·저장, 응답 DTO 변환을 담당한다.
- `domain`: 학생·강의·노트·게시판·퀴즈 및 학습 이력 Entity를 정의한다.
- `dto`: API 요청·응답 모델을 정의한다.
- `repository`: Spring Data JPA 기반 DB 조회와 저장을 담당한다.
- `security`: JWT 검증 후 학번을 `Authentication` principal로 설정한다.
- `exception`: `CourseAccessException` 등의 예외를 JSON 오류 응답으로 변환한다.

## Frontend

- `src/pages`: 로그인, 대시보드, 강의 상세, 퀴즈 보관함 화면을 구성한다.
- `src/components`: 공통 레이아웃, Tiptap 에디터, 퀴즈·오답노트 UI를 제공한다.
- `src/context`: 인증, 강의, 노트 트리 상태를 관리한다.
- `src/routes`: 보호된 라우트를 처리한다.
- `src/api/client.js`: `/api` 기본 URL, JWT 헤더 추가, 401/403 전역 처리를 담당한다.

## 핵심 흐름

### 로그인

1. `LoginPage`가 `POST /api/auth/login`으로 학번과 비밀번호를 전송한다.
2. `AuthService`가 학생을 조회하고 JWT를 발급한다.
3. 프론트엔드는 토큰을 `localStorage`에 저장한다.
4. 이후 Axios 요청에 `Authorization: Bearer <token>`이 추가된다.
5. `JwtFilter`가 토큰을 검증하고 학번을 인증 주체로 설정한다.

### 노트

1. 강의 상세 화면이 강의별 노트 트리를 조회한다.
2. `NoteService`가 강의·학생·부모 노트 관계를 기준으로 노트를 생성하거나 조회한다.
3. `NotionEditor`가 Tiptap JSON을 편집하고 localStorage에 임시 저장한다.
4. 변경 내용은 debounce 후 노트 저장 API로 전송된다.
5. 노트는 계층형 `parentNote` 관계와 Tiptap 콘텐츠를 유지한다.

### 게시판

1. 강의 상세 화면이 강의별 게시글을 조회한다.
2. `PostService`가 게시글·댓글 CRUD와 작성자 확인을 처리한다.
3. `Post`와 `Comment`는 학생을 내부 작성자로 보유하며 응답에서는 익명 표시와 본인 여부를 사용한다.

### 퀴즈

1. 에디터가 노트 ID, 난이도, 문제 유형별 개수를 `QuizController`에 전송한다.
2. `QuizService`가 노트 콘텐츠와 첨부 미디어를 처리해 외부 AI 요청을 구성한다.
3. 생성 결과를 `QuizSet`과 `Question`으로 저장하며 문항에 출처 노트·블록 ID를 기록한다.
4. 사용자가 답안을 제출하면 `QuizAttempt`와 `UserAnswer`를 저장한다.
5. 오답 문항은 `IncorrectNoteGroup`과 `IncorrectNoteItem`으로 그룹화해 재풀이에 사용한다.
