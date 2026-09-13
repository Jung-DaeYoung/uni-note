# UniNote 개발 지침

UniNote는 Spring Boot 백엔드와 React/Vite 프론트엔드로 구성된 풀스택 웹 애플리케이션이다. 기존 기능과 API 계약을 우선 보존하고, 실제 코드와 문서가 다르면 실제 코드를 기준으로 판단한다.

## 기술 스택과 핵심 구조

- Backend: Java 21, Spring Boot 3.4.x, Spring MVC, Spring Data JPA, Spring Security, JWT, MySQL
- Frontend: React 19, Vite, React Router, Axios, Context API, Tiptap, Tailwind CSS
- Backend 흐름: Security/JWT filter → Controller → Service → JPA Repository → MySQL
- Frontend 흐름: Page/Component → Context 또는 상태 로직 → `src/api/client.js` → Spring REST API
- 주요 기능: 인증, 강의·수강, 노트 편집 및 자동 저장, 익명 게시판·댓글, AI 퀴즈, 풀이 기록과 오답노트
- 백엔드 계층은 `controller`, `service`, `domain`, `dto`, `repository`, `security`, `exception` 구조를 따른다.

## 문서 참고 규칙

- 작업 전 관련 문서를 찾아 현재 구조와 API 계약을 확인한다.
- 전체 구조는 `docs/architecture.md`, 데이터 모델은 `docs/db구조.md`, API는 `docs/rest api 설계.md`를 우선 참고한다.
- 요구사항과 기능 범위는 `docs/요구사항 명세서.md`, `docs/세부기능 명세서.md`, AI 퀴즈 흐름은 `docs/ai문제설계.md`를 참고한다.
- `docs/refactoring-plan.md`는 구조와 위험을 파악하기 위한 참고 자료이며, 일회성 파일 수·줄 수·우선순위를 현재 사실로 간주하지 않는다.
- 문서와 실제 코드가 충돌하면 실제 코드와 실행 결과를 우선하고, 관련 문서는 필요한 범위에서만 함께 갱신한다.
- 존재하지 않는 기능, 엔드포인트, 디렉터리, 데이터 필드를 추측해 추가하지 않는다.

## 개발 및 코딩 원칙

- 변경 전에 `git status`와 관련 코드를 확인하고, 요청 범위에 필요한 파일만 수정한다.
- 기존 Controller-Service-Repository 계층과 프론트엔드 페이지·컴포넌트 구조를 유지한다.
- 중복 로직은 기존 공통 코드와 패턴을 먼저 찾아 재사용하되, 불필요한 추상화나 라이브러리를 추가하지 않는다.
- 예외를 조용히 무시하거나 광범위하게 처리하지 말고, 기존 예외 응답 방식에 맞춰 원인을 드러낸다.
- 환경 설정, 비밀 값, API 기본 URL을 코드에 새로 하드코딩하지 않는다. 기존 설정 방식을 먼저 확인한다.
- 응답 필드명, 상태 코드, 저장 형식, 화면 동작을 명시적인 요구 없이 변경하지 않는다.

## 기능 보존 및 API·DB·인증 주의사항

- 기존 REST API 경로와 성공 응답 필드를 유지한다. 변경이 필요하면 호출하는 프론트엔드와 관련 문서를 함께 확인한다.
- JWT 인증 흐름을 우회하지 않는다. 프론트엔드 요청은 `src/api/client.js`의 Axios 설정과 인터셉터를 사용하고, 401/403 처리를 유지한다.
- 백엔드는 인증된 사용자의 강의 수강·리소스 접근 권한을 Service 계층에서 일관되게 검증한다.
- DB 엔티티, 관계, 저장 데이터와 기존 마이그레이션 또는 스키마 동작을 임의로 깨뜨리지 않는다.
- 노트의 Tiptap JSON, 자동 저장 debounce, localStorage 복구, 블록 ID·페이지 링크·첨부 파일 관련 계약을 보존한다.
- 퀴즈 생성·저장·풀이·오답노트 연결과 출처 메타데이터를 변경할 때 관련 API, DTO, 프론트엔드 흐름을 함께 확인한다.
- 외부 AI 연동은 현재 설정과 응답 계약을 유지하고, 제공자 변경이나 프롬프트·스키마 변경은 명시적인 요구와 검증 없이 하지 않는다.

## 테스트 및 검증 규칙

- 변경 범위에 맞는 가장 작은 검증부터 실행한다.
- Backend 변경 후 `backend\gradlew.bat test`를 실행한다.
- Frontend 변경 후 `npm run lint`와 `npm run build`를 실행한다.
- 테스트가 없는 핵심 경로를 변경하면 인증, 권한, API 응답, 저장 흐름 등 회귀 위험이 큰 동작을 우선 확인한다.
- 빌드·테스트 실패를 숨기지 말고 원인과 영향 범위를 확인한 뒤 수정한다.
- 구현 완료 후 변경된 API, DB 저장, 인증, 화면 흐름이 기존 동작과 일치하는지 검토한다.

## Git 규칙

- 작업 시작과 종료 시 `git status`로 변경 범위를 확인한다.
- 관련 없는 사용자 변경을 덮어쓰거나 되돌리지 않는다.
- 커밋이 필요할 때는 논리적으로 하나의 변경 단위로 작성하고, 비밀 정보와 생성 산출물을 포함하지 않는다.
- 커밋 전 diff와 테스트 결과를 확인한다.

## AI 협업 방식

### Codex

분석 → 요구사항 확인 → 구현 계획 작성 → 결과 검토

분석 결과와 실행 가능한 구현 계획은 `current-plan.md`에 작성한다.

### Claude Code

`current-plan.md` 확인 → 구현 → 테스트

### 기본 흐름

`Codex 분석 → current-plan.md → Claude Code 구현 → Codex 검토`

## 작업 계획 문서

- `PLANS.md`는 전체 작업 우선순위를 정의한다.
- `current-plan.md`는 현재 작업의 상세 구현 계획이며, Codex가 분석 후 작성하고 Claude Code가 이를 기준으로 구현한다.
- 작업 완료 후 `current-plan.md`는 다음 작업에 맞게 갱신한다.
