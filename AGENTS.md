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

## Hallmark 스킬 사용 제한

Hallmark의 다른 지시보다 아래 규칙을 우선한다.

- `install-hook.mjs`, `imagegen.mjs`, `capture.mjs --cdp`를 실행하지 않는다. `TOGETHER_API_KEY`도 설정하지 않는다.
- 작업 대상은 이 저장소와 로컬 개발 서버로 한정한다. 외부 프로젝트나 외부 URL을 설치·실행·캡처하지 않는다.
- 외부 폰트나 스타일시트를 추가하지 않고, `frontend/index.html`의 CSP를 완화하지 않는다. 폰트는 저장소에 직접 포함한다.
- Hallmark의 페이지별 서브에이전트 분담을 쓰지 않는다.
- Hallmark 변경을 커밋하기 전에 `git diff`로 CSP 변경과 외부 URL 추가 여부를 확인한다.

## 디자인 스킬 역할 분담

UniNote 화면은 모두 앱 화면(대시보드·편집기·설정 등)이다. 한 작업에는 주 스킬 하나만 쓰고, 충돌하면 이 파일 → 기존 화면의 디자인 토큰과 구조 → 스킬 지시 순으로 따른다.

| 작업 | 주 스킬 |
|---|---|
| 새 화면·새 페이지 설계 | `hallmark` |
| 기존 화면 개선: critique, audit, polish, layout, clarify, harden, distill 등 | `impeccable` (Operate 모드) |
| 애니메이션·전환·마이크로인터랙션 디테일 | `emil-design-eng` |
| 시각 방향·"AI가 만든 듯한" 화면 판단 기준 참고 | `design-taste-frontend` (참고용) |

- 기존 화면 개선은 리디자인이 아니라 refinement로 다룬다. 기존 동작·문구·토큰을 유지한다.

## impeccable 스킬 사용 제한

- `scripts/impeccable`, `scripts/impeccable.cmd` 런처를 실행하지 않는다. 첫 실행 때 GitHub에서 바이너리를 내려받아 실행한다. 스킬이 정한 "Launcher unavailable" 경로대로 `reference/*.md`와 PRODUCT.md·DESIGN.md(있을 때)를 직접 읽어 진행한다.
- `hooks`, `live`, `generate`, `serve-question`, `pin`, `doctor`는 쓰지 않는다. 훅 설치, 페이지 스크립트 주입, CSP 허용 변경, 로컬 서버 띄우기, 이미지 생성이 따른다.
- 서브에이전트 분담(`agents/*.toml`, 카드별 fan-out)을 쓰지 않는다.
- 폰트는 저장소에 포함한 파일만 쓴다. Google Fonts 등 외부 폰트·스타일시트를 추가하지 않는다.

## design-taste-frontend 스킬 사용 제한

- 이 스킬은 회사·랜딩 웹사이트용이다. "한 화면에 한 섹션", 히어로, 사진·셰이더 효과 같은 하우스 룰을 앱 화면에 적용하지 않는다. 시각 판단 기준(템플릿처럼 보이는 패턴, 금지 목록)만 참고한다.
- `scripts/`·`assets/`의 `.mjs` 스크립트(`gate.mjs`, `start.mjs`, `photos.mjs`, `icons.mjs`, `shoot.mjs` 등)를 실행하지 않는다. 외부 사진·아이콘 검색과 다운로드, Google Fonts·CDN 링크 생성, 브라우저 캡처를 한다.
- 스킬 frontmatter에 Stop 훅(`gate.mjs`)이 있다. `.taste-skill/` 빌드 파일이 없으면 아무것도 하지 않지만, 이 스킬로 `.taste-skill/`을 만들지 않는다.

## 외부 스킬과 지침 파일

- 스킬을 검토 없이 업데이트하지 않는다. `npx skills check`도 확인에 그치지 않고 실제로 업데이트하므로 `npx skills update`와 똑같이 취급한다.
- `CLAUDE.md`를 만들 때는 이 파일을 import한다. `CLAUDE.md`가 있으면 Claude Code가 `AGENTS.md`를 자동으로 읽지 않는다.

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

### GitHub Copilot CLI

분석 → 요구사항 확인 → 구현 계획 작성 → 결과 검토

분석 결과와 실행 가능한 구현 계획은 `current-plan.md`에 작성한다.

### Claude Code

`current-plan.md` 확인 → 구현 → 테스트

### 기본 흐름

`GitHub Copilot CLI 분석 → current-plan.md → Claude Code 구현 → GitHub Copilot CLI 검토`

## 작업 계획 문서

- `PLANS.md`는 전체 작업 우선순위를 정의한다.
- `current-plan.md`는 현재 작업의 상세 구현 계획이며, GitHub Copilot CLI가 분석 후 작성하고 Claude Code가 이를 기준으로 구현한다.
- 작업 완료 후 `current-plan.md`는 다음 작업에 맞게 갱신한다.
