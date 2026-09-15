# UniNote 전체 프로젝트 리팩터링 계획

## 작업 원칙

- 실제 코드와 참조 관계를 확인한 문제만 수정한다.
- 정상 동작하는 기능과 기존 API 계약은 유지한다.
- 최근 Slash Command 리팩터링은 현재 정상 상태를 기준으로 보호한다.
- 새로운 추상화, 공통 레이어, 라이브러리는 필요한 근거가 있을 때만 추가한다.
- 한 번에 하나의 문제만 수정한다.
- `수정 → 테스트 → 회귀 확인 → 다음 수정` 순서로 진행한다.
- 관련 없는 사용자 변경은 덮어쓰거나 되돌리지 않는다.

## 이번 개정 사항 (코드 대조 검토 반영)

실제 코드와 대조 검토한 결과를 반영해 우선순위와 실행 순서를 다음과 같이 조정했다. 문제 자체의 존재 여부는 이전 버전과 대부분 동일하게 확인되었다.

- **P0로 상향**: 오답노트 그룹 소유권 누락(구 P1-3) → `P0-5`. 다른 사용자 데이터에 쓰기가 가능한 IDOR로 P0-2/P0-3과 동일한 위험군이며, 같은 서비스 클래스에 이미 동일한 검증 패턴이 있어 수정 비용도 낮다.
- **P1로 상향**: 대시보드 게시글 범위(구 P2-2) → `P1-8`. 공격자의 별도 행동 없이 로그인한 모든 사용자에게 상시 노출되는 구조라 사용자 행동이 필요한 다른 P1 항목보다 시급하다.
- **P3로 하향/축소**: JWT httpOnly 쿠키 전환(구 P1-6)은 CSRF 대응까지 포함하는 별도 아키텍처 변경이므로 `P3-7`로 분리하고, P1에는 단기 완화책만 남긴다(`P1-5`). 프론트 lint 정리(구 P2-9)는 런타임 영향이 없는 DX 이슈이므로 `P3-8`로 내린다.
- **의존성 추가**: P0-2/P0-3/P0-5의 검증 기준(403 응답)은 현재 `IllegalArgumentException`이 전부 401로 매핑되는 구조에서는 만족될 수 없다. 예외 상태 코드 분리(구 P1-8, 이번 `P1-7`) 중 소유권 위반 관련 부분을 P0와 동시에 처리하도록 실행 순서를 조정했다.
- **회귀 위험 추가 발견**: 파일 업로드 인증(`P1-1`)을 그대로 적용하면 에디터가 이미지를 `<img src>`로, PDF를 `window.location.href`로 직접 요청하는데 이 두 경로는 Authorization 헤더가 붙지 않는다. 인증 도입 전에 서빙 방식을 함께 설계하지 않으면 "보호할 기능"의 이미지/PDF 업로드 command가 깨진다.
- **원인 정정**: 업로드 파일이 Git에 추적된 원인(`P3-5`)은 관리 소홀이 아니라 루트 `.gitignore`가 `.gitignore content placeholderbackend/uploads/` 한 줄로 손상되어 있기 때문으로 확인됨. 같은 원인으로 `.idea/workspace.xml`도 함께 추적되고 있다. `application-local.yaml`(DB 비밀번호·JWT secret 포함)은 `backend/.gitignore`가 별도로 막고 있어 git에는 커밋되지 않았음을 확인했다.
- **범위 제한 명시**: AI 연동 안정성(`P2-2`), 프론트 요청 정리(`P2-7`) 항목에 "새 라이브러리·프레임워크를 추가하지 않는다"는 제약을 명시해 과설계를 방지한다.

## 보호할 기능

### Slash Command

- `/` 입력 시 메뉴 표시
- 검색어 필터링
- ArrowUp/ArrowDown 선택
- Enter 명령 실행
- 마우스 클릭 실행
- Escape로 메뉴 닫기
- 메뉴 종료 후 일반 Enter
- 이미지/PDF 업로드 command
- 하위 노트 생성 command
- `SuggestionList`의 포커스 보호와 직접 스크롤 처리
- `SlashCommand.js`의 `priority: 1000` 설정과 `NotionEditor.jsx` extensions 배열 내 `SlashCommand` 위치를 변경하지 않는다 (Enter가 `CustomHeading`/`CustomParagraph`보다 먼저 처리되게 하는 근거이며, 이걸 건드리면 Enter로 메뉴 선택이 안 되는 버그가 재발한다)

대상 파일:

- `frontend/src/components/editor/extensions/SlashCommand.js`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/editor/components/SuggestionList.jsx`

> `P2-4`(자동 저장), `P2-6`(업로드 신뢰 경계)는 `NotionEditor.jsx` 안의 `SlashCommand.configure({...})` 블록과 같은 파일을 수정한다. 업로드 command·자동 저장 effect 내부만 고치고 `extensions` 배열 순서와 `priority`는 건드리지 않는다.

### 기존 핵심 기능

- 노트 Tiptap JSON 저장과 복구
- 자동 저장 및 localStorage 임시 저장
- 강의·수강 권한
- 익명 게시판과 댓글
- AI 퀴즈 생성·풀이·오답노트
- 이미지/PDF 업로드
- JWT 인증 및 기존 API 경로·응답 필드

## 확인된 정상 동작

- `JwtUtil`의 JWT secret 길이·빈 값·만료 검증
- Stateless JWT filter 구조
- 노트 생성(`createNote`)의 수강 검증
- 게시글·댓글 수정/삭제의 작성자 검증
- 오답노트 삭제·문제 제거·복습 세션의 그룹 소유자 검증 (`addToGroup`만 예외적으로 누락 — `P0-5`)
- Tiptap Slash Command의 현재 Enter·마우스 선택 흐름
- 자동 저장의 localStorage 저장 및 debounce 서버 저장 기본 흐름

# P0 — 즉시 수정해야 하는 보안·데이터 경계

## P0-1. 평문 비밀번호 및 secret 제거

**위치**

- `backend/src/main/java/com/uninote/backend/security/SecurityConfig.java:27-29`
- `backend/src/main/java/com/uninote/backend/service/AuthService.java:29-38`
- `backend/src/main/resources/application-local.yaml:3-7`

**문제**

- `NoOpPasswordEncoder`를 사용한다.
- 로그인에서 비밀번호를 평문 비교한다.
- DB 비밀번호와 JWT secret이 local 설정에 직접 기록되어 있다.
- 로그인 로그에 학번과 비밀번호 길이가 기록된다.

**수정 방법**

- BCrypt 또는 Argon2로 교체한다.
- 기존 평문 비밀번호를 일회성 마이그레이션으로 해시화한다.
- `passwordEncoder.matches()`를 사용한다.
- DB 비밀번호와 JWT secret을 환경 변수 또는 secret 저장소로 이동한다.
- 기존 노출 자격 증명은 교체한다.
- 로그인 실패 응답과 로그에서 계정 존재 여부 및 민감 정보를 제거한다.

**검증**

- 해시 비밀번호 로그인 성공
- 잘못된 학번과 비밀번호의 응답 통일
- 평문 비밀번호 로그인 제거
- 로그와 저장소에 secret·비밀번호가 남지 않는지 확인

## P0-2. 노트 소유권 검증 누락

**위치**

- `backend/src/main/java/com/uninote/backend/controller/NoteController.java:22-52`
- `backend/src/main/java/com/uninote/backend/service/NoteService.java:35-52, 88-99, 101-112`

**문제**

- `PUT /api/notes/{noteId}`가 인증 주체를 서비스에 전달하지 않는다(컨트롤러 메서드에 `@AuthenticationPrincipal`이 아예 없음).
- `getNote()`는 `studentNum`을 받지만 사용하지 않는다. 대신 `note.getStudent()`(노트 소유자)가 자기 강의를 수강 중인지 검사하는데, 이는 항상 참이라 사실상 아무 것도 검증하지 않는다.
- `getNoteTree()`는 강의 존재 여부만 확인하고, 해당 강의의 **모든 학생의 루트 노트**를 그대로 반환한다(수강 여부·소유자 필터링 없음).
- `deleteNote()`는 요청자의 강의 수강 여부만 확인하고, 노트가 그 학생의 것인지는 확인하지 않는다. 같은 강의를 듣는 다른 학생의 노트도 삭제될 수 있다.
- 다른 사용자의 노트 조회·수정·삭제 가능성이 있다.

**의존성**

- 아래 검증 기준(403)을 실제로 만족하려면 예외 처리를 함께 손봐야 한다. 기존 `CourseAccessException`(이미 403으로 매핑되어 있음)을 재사용하거나, `P1-7`(예외 응답 상태 불일치) 중 소유권 위반 관련 부분을 이 항목과 동시에 처리한다. 그렇지 않으면 새로 추가한 검증도 `IllegalArgumentException` 경로를 타 401로만 응답한다.

**수정 방법**

- 조회·트리·저장·삭제에 인증된 학생을 전달한다.
- 노트 소유자와 현재 학생을 비교한다.
- 해당 강의 수강 여부를 함께 확인한다.
- 삭제도 강의 수강 여부뿐 아니라 노트 소유자 일치를 함께 확인한다.
- 트리 조회를 `courseId + student` 범위로 제한한다.

**검증**

- 사용자 A가 사용자 B 노트를 조회·수정·삭제하면 `403`
- 같은 강의를 듣는 다른 학생의 노트를 삭제하면 `403`
- 미수강 강의 트리 조회 차단
- 정상 소유자의 자동 저장 성공

## P0-3. 퀴즈·풀이 기록 소유권 검증 누락

**위치**

- `backend/src/main/java/com/uninote/backend/controller/QuizController.java:28-30, 64-67`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java:99-114, 160-196`

**문제**

- 퀴즈 상세와 풀이 상세가 ID만으로 조회된다.
- 다른 사용자의 문제·정답·해설·풀이 기록을 조회할 수 있다.
- 같은 클래스의 `deleteQuiz`, `getAttemptsByQuizSet`/`getMyAttempts`는 이미 학생 범위로 조회하고 있어, 이 두 상세 조회만 예외적으로 누락된 것으로 보인다.

**의존성**

- `P0-2`와 동일하게, 403 응답을 위해 예외 매핑을 함께 처리한다(`P1-7` 참고).

**수정 방법**

- 상세 조회에 현재 학생을 전달한다.
- `quizSet.student`, `attempt.student` 소유권을 확인한다.
- 가능하면 소유자 조건을 Repository 쿼리에 포함한다.

**검증**

- 사용자 간 퀴즈 상세 교차 조회 차단(`403`)
- 사용자 간 풀이 상세 교차 조회 차단(`403`)
- 정상 사용자의 자기 퀴즈·풀이 조회 성공

## P0-4. 클라이언트 점수와 정답 여부 신뢰

**위치**

- `backend/src/main/java/com/uninote/backend/service/QuizService.java:116-142`
- `backend/src/main/java/com/uninote/backend/dto/QuizAttemptRequest.java`

**문제**

- 요청의 `score`, `isCorrect`를 서버가 그대로 저장한다.
- 다른 퀴즈에 속한 문제를 제출할 수 있다.

**수정 방법**

- 서버에서 제출 답안과 정답을 비교한다.
- 서버가 점수와 정답 여부를 계산한다.
- 문제의 퀴즈 세트가 요청 퀴즈와 일치하는지 검증한다.
- 클라이언트 점수 필드는 무시하거나 제거한다.

**검증**

- 조작한 점수·정답 여부가 반영되지 않음
- 다른 퀴즈 문제 제출 차단
- 정상 답안 점수 계산

## P0-5. 오답노트 그룹 소유권 누락 (P1에서 상향)

**위치**

- `backend/src/main/java/com/uninote/backend/service/IncorrectNoteService.java:34-51`

**문제**

- 기존 `groupId`로 문제를 추가할 때(`addToGroup`) 그룹 소유자를 확인하지 않는다.
- 다른 사용자의 그룹에 문제를 추가할 수 있다.
- 같은 클래스의 `deleteGroup`, `removeItemFromGroup`, `getPracticeSession`은 이미 소유자 검증을 하고 있어, `addToGroup`만 예외적으로 누락된 것으로 보인다. 수정 비용이 낮고 다른 P0 항목과 동일한 IDOR(쓰기 가능) 위험이라 P0로 처리한다.

**수정 방법**

- 그룹 소유자를 검증한다.
- `findByIdAndStudent_StudId()` 형태의 조회를 사용한다(같은 클래스의 다른 메서드와 동일한 패턴).

**검증**

- 타 사용자 그룹 추가 차단(`403`)
- 자기 그룹 정상 추가
- 동일 문제 중복 추가 방지

# P1 — 배포 전 수정해야 하는 보안·운영 문제

## P1-1. 파일 업로드·다운로드 공개

**위치**

- `backend/src/main/java/com/uninote/backend/security/SecurityConfig.java:41`
- `backend/src/main/java/com/uninote/backend/controller/ImageUploadController.java:26-108`
- `backend/src/main/java/com/uninote/backend/config/WebConfig.java:14-20`

**문제**

- `/api/upload/**`, `/uploads/**`가 `permitAll()`이다.
- `WebConfig`가 `/uploads/**`를 물리 디렉터리에 직접 매핑해, 컨트롤러의 다운로드 엔드포인트와 별개로 업로드 파일이 이미 전부 공개되어 있다.
- 누구나 업로드할 수 있고 URL을 아는 파일을 다운로드할 수 있다.
- MIME, 실제 파일 형식, 용량, 저장 총량 검증이 없다.

**회귀 위험 (설계 선행 필요)**

- 에디터는 이미지를 `<img src>`로, PDF를 `window.location.href` 이동으로 직접 요청한다. 이 두 경로는 axios interceptor를 거치지 않으므로 Authorization 헤더가 붙지 않는다.
- 다운로드·정적 리소스에 그대로 인증을 강제하면 "보호할 기능"의 이미지/PDF 업로드 command가 깨진다(이미지 미표시, PDF 다운로드 실패).
- 인증을 적용하기 전에 다음 중 하나로 서빙 방식을 먼저 설계한다: 서명된 단기 유효 URL, 세션 쿠키 기반 인증, 또는 axios로 blob을 받아 object URL로 렌더링. 업로드 POST 자체는 공용 `client`(Authorization 자동 첨부)를 이미 쓰고 있어 문제없다.

**수정 방법**

- 업로드·다운로드에 인증을 적용한다(위 서빙 방식 설계를 반영).
- 파일 소유자와 연결된 노트·강의 정보를 저장한다.
- 다운로드 시 리소스 접근 권한을 검증한다.
- MIME, signature, 확장자, 파일 크기를 서버에서 검증한다.
- 운영에서는 외부 파일 저장소 또는 별도 정적 파일 서버를 검토한다.

**검증**

- 비인증 업로드·다운로드 거부
- 타 사용자 파일 다운로드 거부
- 허용되지 않은 MIME·위조 확장자·초과 파일 거부
- 인증 적용 후에도 에디터에서 기존 이미지·PDF가 정상적으로 보이고 다운로드되는지 확인 (Slash Command 이미지/PDF 업로드 command 회귀 없음)

## P1-2. 파일 경로 조작 가능성

**위치**

- `ImageUploadController.java:30-53`(다운로드), `66-108`(업로드)

**문제**

- 다운로드 엔드포인트가 입력 파일명을 `Paths.resolve()`로 직접 결합하며, 정규화 및 기준 디렉터리 하위 여부 검증이 없다.
- 업로드는 저장 파일명 자체를 `UUID + 확장자`로 만들어 경로 조작에는 안전하지만, 확장자를 사용자 입력에서 그대로 가져와 화이트리스트 없이 신뢰한다(`.jsp`, `.php`, 이중 확장자 등도 그대로 저장됨).

**수정 방법**

- `normalize()` 후 기준 디렉터리 하위인지 확인한다.
- 다운로드에는 파일명 대신 서버 파일 ID를 사용한다.
- 확장자 화이트리스트를 서버에서 강제한다.
- `Content-Disposition` 파일명에서 CR/LF 및 경로 문자를 제거한다.

**검증**

- `../`, 절대 경로, 인코딩된 경로 차단
- 정상 UUID 파일만 다운로드
- 허용되지 않은 확장자 업로드 차단

## P1-3. AI 퀴즈 생성 입력 권한 누락

**위치**

- `backend/src/main/java/com/uninote/backend/service/QuizService.java:29-34`

**문제**

- 요청된 note ID의 소유자·수강 여부를 확인하지 않는다.
- 다른 사용자의 노트가 외부 AI API로 전송될 수 있다.
- `findAllById`로 조회하기 때문에, 존재하지 않거나 타인 소유인 note ID가 조용히 누락되어도 개수 불일치가 감지되지 않는다.

**수정 방법**

- 요청한 모든 노트가 현재 학생 소유인지 확인한다.
- 강의 수강 여부를 확인한다.
- 요청 ID 개수와 조회 결과 개수가 일치하는지 검증한다.
- 여러 강의 노트가 섞이지 않도록 제한한다.

**검증**

- 타 사용자·미수강·미존재 노트 요청 차단
- 정상 노트만 AI 입력에 포함

## P1-4. 환경별 URL과 CORS 하드코딩

**위치**

- `frontend/src/api/client.js:4`
- `frontend/src/components/editor/hooks/useNoteUploads.js:3`
- `frontend/src/components/editor/extensions/PdfBlock.jsx:14`
- `backend/src/main/java/com/uninote/backend/security/SecurityConfig.java:52-53`

**문제**

- API와 파일 URL이 `localhost`로 하드코딩되어 있다(3곳에서 중복).
- CORS 허용 origin이 `http://localhost:5173` 하나로 고정되어 있다.
- PDF 다운로드/새 탭 열기는 raw URL 이동이라 Axios Authorization interceptor를 거치지 않는다(`P1-1`의 서빙 방식 설계와 함께 처리).

**수정 방법**

- `VITE_API_BASE_URL` 등 환경 설정으로 API origin을 통일한다.
- 중복된 `SERVER_URL`을 제거한다.
- CORS origin을 프로파일별 제한된 환경 설정으로 관리한다.

**검증**

- 로컬·스테이징·운영 origin별 로그인·업로드·이미지·PDF 확인
- 운영 빌드에 localhost가 남지 않는지 확인
- 허용되지 않은 origin 차단

## P1-5. JWT localStorage 저장 (단기 완화)

**위치**

- `frontend/src/context/AuthContext.jsx:6-17`
- `frontend/src/api/client.js:7-12`

**문제**

- XSS 발생 시 localStorage JWT가 탈취될 수 있다.
- 인증 상태는 토큰 존재 여부만 확인한다(만료 여부를 클라이언트에서 별도 검사하지 않음).
- 여러 401 응답에서 상태와 redirect가 중복 처리될 수 있다.

**수정 방법**

- CSP를 적용하고, 토큰 만료(`exp`)를 클라이언트에서도 디코드해 검사한다.
- 만료를 짧게 유지한다.
- AuthContext와 Axios interceptor의 로그아웃 경로를 단일화한다.
- HttpOnly·Secure·SameSite 쿠키로의 전면 전환은 CSRF 대응까지 포함하는 별도 아키텍처 변경이므로 지금 범위에 넣지 않는다 (`P3-7` 참고).

**검증**

- 만료·잘못된 토큰 처리
- 동시 401에서 중복 redirect 방지
- 탭 간 login/logout 상태 확인

## P1-6. 운영 DB 설정 위험

**위치**

- `backend/src/main/resources/application.yaml:1-24`
- `backend/src/main/resources/application-local.yaml`

**문제**

- 기본 설정에 `ddl-auto: update`, `show-sql: true`가 있고, 프로파일로 분리되어 있지 않다(`application-prod.yaml` 없음).
- 운영에서 자동 스키마 변경과 SQL 로그 노출 위험이 있다.
- `useSSL=false`는 운영 DB 연결에 부적절하다.

**수정 방법**

- 개발 프로파일에서만 `update`와 SQL 출력을 사용한다.
- 운영은 `validate` 또는 migration 도구를 사용한다.
- 운영 DB TLS와 외부 secret을 사용한다.

**검증**

- 운영 프로파일 기동
- 스키마 자동 변경이 발생하지 않는지 확인
- secret 미주입 시 안전하게 실패하는지 확인

## P1-7. 예외 응답 상태 불일치

**위치**

- `backend/src/main/java/com/uninote/backend/exception/GlobalExceptionHandler.java:13-35`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- `backend/src/main/java/com/uninote/backend/service/IncorrectNoteService.java`
- `backend/src/main/java/com/uninote/backend/service/NoteService.java`

**문제**

- 모든 `IllegalArgumentException`을 401로 변환한다(단, `CourseAccessException`은 이미 403으로 별도 매핑되어 있음).
- 없는 리소스, 잘못된 요청, 권한 부족이 인증 실패로 표현된다.
- 프론트 Axios interceptor가 단순 입력 오류도 로그인 만료로 처리할 수 있다.

**선행 처리 항목**

- 소유권 위반(403) 관련 부분은 2단계(P0)에서 노트·퀴즈·오답노트 소유권 검증과 **동시에** 처리한다(기존 `CourseAccessException` 재사용 또는 동등한 전용 예외 추가). 이 항목에서는 나머지 400/404 구분을 마무리한다.

**수정 방법**

- `400`, `401`, `403`, `404`용 명시적 예외 타입과 응답 코드를 정의한다.
- 예기치 않은 예외의 내부 메시지는 외부에 노출하지 않는다.
- 프론트는 인증 만료 코드에만 로그아웃 처리한다.

**검증**

- 없는 리소스 `404`
- 권한 없음 `403`
- 잘못된 요청 `400`
- 인증 실패 `401`

## P1-8. 대시보드 데이터 범위 (P2에서 상향)

**위치**

- `backend/src/main/java/com/uninote/backend/service/DashboardService.java:34-65`

**문제**

- 최근 게시글을 `findTop5ByOrderByCreatedAtDesc()`로 전체 게시글에서 가져와 미수강 강의 게시글이 노출될 수 있다.
- 위에서 계산해 두는 수강 강의 목록을 이 조회에 사용하지 않는다.
- 공격자의 별도 행동 없이 로그인한 모든 사용자에게 상시 노출되는 구조라, 사용자 행동이 필요한 다른 P1 항목보다 먼저 처리한다.

**수정 방법**

- 현재 학생의 수강 강의에 한정한 조회를 사용한다.

**검증**

- 미수강 강의 게시글이 대시보드에 노출되지 않는지 확인
- 정상 수강 강의 게시글은 그대로 노출되는지 확인

# P2 — 기능 일관성·성능·구조 문제

## P2-1. 부모 노트와 게시판 수강 권한

**위치**

- `NoteService.java:75-80`
- `PostService.java:23-48` (EnrollmentRepository 자체가 주입되어 있지 않음)

**문제**

- 부모 노트의 강의·소유자 일치 검증이 없다(다른 강의·다른 학생의 노트를 부모로 지정 가능).
- 게시판 조회·작성·댓글 작성에 수강 권한 검증이 전혀 없다.

**수정 방법**

- 부모 노트의 course/student를 현재 요청과 비교한다.
- 게시글 조회·작성·댓글 작성에 enrollment 검증을 적용한다.

**검증**

- 다른 강의·다른 학생의 노트를 부모로 지정하면 차단
- 미수강 강의 게시판 조회·작성·댓글 차단

## P2-2. AI 외부 연동 안정성

**위치**

- `backend/src/main/java/com/uninote/backend/service/QuizAiGenerationService.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java:67-70`
- `backend/src/main/java/com/uninote/backend/config/RestClientConfig.java`

**문제**

- API key, `typeCounts`, AI 응답 구조, timeout 검증이 부족하다.
- `RestTemplate` 빈에 connect/read timeout이 전혀 설정되어 있지 않다.
- 비정상 응답과 외부 장애가 일반 `RuntimeException`으로 처리된다.
- 파일을 메모리와 Base64로 읽으며 총 요청 크기 제한이 없다.

**범위 제한**

- 범용 재시도·검증 프레임워크를 새로 만들지 않는다. 설정값 필수 검증 + timeout 설정 + AI 응답 필드 존재 확인 수준의 최소 구현으로 제한한다.

**수정 방법**

- 설정 필수값을 시작 시 검증한다.
- DTO 입력과 문제 수·노트 수·미디어 크기를 제한한다.
- AI 응답을 단계별로(존재 여부만) 검증한다.
- `RestTemplate`에 connect/read timeout과 명시적 외부 연동 예외를 추가한다.
- 파일 소유권과 총 미디어 크기를 확인한다.

## P2-3. JPA N+1 및 대량 응답

**위치**

- `PostService.java:23-30, 121-158`
- `NoteService.java:44-52, 140-148`
- `QuizService.java:99-114, 160-196`

**문제**

- 댓글, 자식 노트, 퀴즈 문제, 풀이 답안 컬렉션을 응답 변환 중 lazy loading한다.
- 데이터 증가 시 SQL 수와 응답 시간이 급증할 수 있다.
- 노트 트리에 깊이 제한이 없다.

**수정 방법**

- API별 fetch join, entity graph 또는 projection을 사용한다.
- 필요한 컬렉션을 배치 조회한다.
- 페이지네이션과 트리 깊이·응답 크기 제한을 적용한다.
- 실제 성능 측정 후 개선 범위를 정한다(측정 없이 구조부터 바꾸지 않는다).

## P2-4. 자동 저장 JSON 파싱 및 경쟁 상태

**위치**

- `frontend/src/components/editor/hooks/useNoteAutosave.js:16-19, 47-72, 95-98`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/pages/CourseDetailPage.jsx`

**문제**

- 서버 콘텐츠 또는 localStorage가 손상되면 `JSON.parse()` 예외로 에디터가 실패할 수 있다.
- 이전 노트의 저장 요청이 노트 전환 후에도 진행될 수 있다(`key={noteId}` 리마운트는 에디터 상태 오염은 막지만, 이미 진행 중인 PUT 요청 자체는 취소하지 않는다).
- 늦게 도착한 응답이 현재 화면의 `onSaved`를 호출할 수 있다.
- 저장 실패 시 재시도 경로가 없다.

**수정 방법**

- 서버 데이터와 localStorage 파싱을 명시적으로 보호하고 schema를 검증한다.
- AbortController 또는 noteId별 요청 세대 번호를 사용한다.
- 저장 실패 시 재시도·즉시 저장 UI를 제공한다.
- 필요하면 서버 version/updatedAt 기반 optimistic locking을 적용한다.

**진행 순서**

```text
JSON 파싱 보호
→ noteId 경쟁 상태 보호
→ 저장 실패 재시도
→ 대형 문서 성능 개선
```

**주의**

- `NotionEditor.jsx` 안의 `SlashCommand.configure({...})` 블록과 `priority: 1000`은 이 항목의 수정 범위가 아니다. 자동 저장 관련 effect/훅만 수정한다.

## P2-5. 노트 조회·생성 race

**위치**

- `frontend/src/hooks/useCourseNotes.js:21-53`

**문제**

- 빠른 노트 전환에서 이전 GET 응답이 현재 상태를 덮을 수 있다.
- StrictMode와 effect 재실행으로 최초 노트 생성 POST가 중복될 수 있다.

**수정 방법**

- 요청 취소 또는 request ID 검증을 추가한다.
- noteId 변경 시 이전 데이터를 초기화한다.
- 최초 노트 생성에 실행 세대·중복 방지 플래그를 사용한다.
- 서버에도 idempotent 생성 계약을 검토한다.

## P2-6. 업로드·Tiptap 콘텐츠 신뢰 경계

**위치**

- `frontend/src/components/editor/hooks/useNoteUploads.js`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/editor/extensions/PdfBlock.jsx`
- `frontend/src/components/editor/extensions/PageLink.jsx`

**문제**

- 파일 크기·실제 MIME·확장자 검증과 업로드 진행 상태가 부족하다(`accept` 속성은 UI 힌트일 뿐 강제력이 없음).
- 서버의 이미지·PDF URL을 별도 정책 없이 문서에 저장·렌더링한다(스킴/오리진 검증 없음).
- 업로드 실패가 `null`과 console 출력으로 끝난다(사용자에게 보이는 오류 없음).

**수정 방법**

- 서버 검증(`P1-2`)을 기준으로 클라이언트 검증을 맞춘다.
- 허용 scheme과 origin을 제한한다.
- 업로드 상태와 실패 메시지를 UI에 표시한다.
- 파일 URL은 가능하면 서버 파일 식별자 기반으로 처리한다.

**주의**

- 이미지/PDF 업로드 command의 실행 결과(성공 시 삽입되는 내용)는 바뀌지 않아야 한다. command 내부 로직만 보강하고 `SlashCommand`의 메뉴 항목 구성·`items()` 필터링은 건드리지 않는다.

## P2-7. 프론트 요청·상태 중복과 오류 처리

**위치**

- `frontend/src/context/CourseContext.jsx`
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/api/client.js`
- `frontend/src/hooks/useCourseNotes.js`
- `frontend/src/hooks/useCourseBoard.js`

**문제**

- `/dashboard/courses`를 Context와 Dashboard가 중복 호출한다.
- 노트·게시글 요청에서 빠른 전환과 stale response를 일관되게 처리하지 않는다.
- Axios interceptor가 직접 redirect와 alert를 수행해 화면 상태와 결합된다.

**범위 제한**

- react-query/SWR 등 새 데이터 fetching 라이브러리를 추가하지 않는다. 기존 Context/hook 구조 안에서 중복 호출 제거와 요청 취소만 처리한다.

**수정 방법**

- 대시보드와 사이드바의 데이터 책임을 분리하되 중복 요청을 제거한다.
- 요청 취소 또는 request ID 검증을 적용한다.
- 인증 이벤트와 화면별 오류 표시를 분리한다.

# P3 — 품질·유지보수·저장소 위생

## P3-1. DTO 입력 검증 부족

**위치**

- `backend/src/main/java/com/uninote/backend/dto`
- 각 Controller의 `@RequestBody`

**문제**

- `@Valid`, `@NotBlank`, `@Size`, `@NotNull`, `@Positive`가 부족하다.
- 긴 제목·댓글·그룹명·퀴즈 요청과 음수 ID를 허용할 수 있다.

**수정 방법**

- DTO에 Bean Validation을 적용하고 Controller에서 `@Valid`를 사용한다.
- validation 오류도 공통 ErrorResponse로 반환한다.

## P3-2. 핵심 API 테스트 부족

**위치**

- `backend/src/test`
- `frontend/src`

**문제**

- 현재 백엔드 테스트는 JWT, mapper, AI 일부, context load 중심이다(`controller` 테스트 패키지 자체가 없음).
- Controller 권한, API 계약, 파일 업로드, 자동 저장, Axios 401/403, Slash Command 회귀 테스트가 부족하다.

**주의**

- P0/P1의 소유권·권한 관련 테스트는 이 단계까지 미루지 않고 해당 항목(2~3단계)을 수정하는 시점에 즉시 작성한다. 이 항목에서는 나머지 API 계약·회귀 테스트를 확장한다.

**수정 방법**

- `@WebMvcTest`로 인증·권한·상태 코드·DTO 검증을 테스트한다.
- `@DataJpaTest`로 소유자 조건 Repository를 테스트한다.
- 서비스 권한과 AI 실패를 단위 테스트한다.
- 프론트 API client, AuthContext, 자동 저장, Slash Command의 `/`, 필터링, Enter, 마우스 선택을 회귀 테스트로 고정한다.

## P3-3. 미사용 Repository와 중복 조회

**위치**

- `NoteRepository.java` (`findByCourseAndStudent`)
- `QuestionRepository.java` (`findByQuizSet_QuizSetId`)
- `QuizSetRepository.java` (`findByCourse_CourseIdAndStudent_StudId`)
- 각 Controller/Service의 `studentRepository.findByStudentNum(...)` 반복 호출

**문제**

- 위 세 Repository 메서드는 선언만 있고 실제 호출부가 없다.
- `studentRepository.findByStudentNum(...).orElseThrow(...)` 패턴이 여러 Controller와 Service에 중복된다.

**수정 방법**

- 실제 참조를 다시 확인한 뒤 미사용 메서드를 제거하거나 권한 조회에 활용한다.
- API 계약을 바꾸지 않는 범위에서 인증 사용자 조회 중복을 정리한다(작은 헬퍼/전용 argument resolver 등 최소 추상화만 도입).

## P3-4. Context 및 자동 저장 성능

**위치**

- `frontend/src/context`
- `frontend/src/components/editor/hooks/useNoteAutosave.js`

**문제**

- Context value와 함수가 매 렌더마다 새로 생성될 수 있다.
- 자동 저장마다 JSON/text 직렬화와 localStorage 기록이 실행된다.
- 대형 문서에서 입력 지연과 localStorage quota 오류 가능성이 있다.

**수정 방법**

- 실제 성능 측정 후 필요한 Context에만 `useMemo/useCallback`을 적용한다.
- dirty flag 또는 transaction 기반 변경 감지를 검토한다.
- localStorage 저장도 별도 debounce를 적용하고 quota 오류를 표시한다.

## P3-5. 생성 산출물과 업로드 파일 관리

**위치**

- `backend/uploads/*.png`, `backend/uploads/*.pdf`
- 저장소 루트 `.gitignore`
- `backend/build`, `backend/.gradle`, `frontend/dist` (참고용 — 이미 정상적으로 ignore되고 있음)

**문제**

- 업로드 파일 14개가 Git에 추적되어 있다.
- **원인**: 루트 `.gitignore`가 `.gitignore content placeholderbackend/uploads/` 한 줄로 손상되어 있어(줄바꿈 없이 플레이스홀더 텍스트와 패턴이 붙어버림) `backend/uploads/` 패턴이 실제로 적용되지 않는다.
- 같은 원인으로 `.idea/workspace.xml`, `backend/.idea/workspace.xml`(IDE 개인 상태 파일)도 함께 추적되고 있다.
- `backend/.gitignore`, `frontend/.gitignore`는 정상 동작하며 `build`/`.gradle`/`dist`는 실제로 추적되지 않고 있음을 1단계 감사에서 확인했다(이 부분은 문제 없음).
- `application-local.yaml`(DB 비밀번호·JWT secret 포함)은 `backend/.gitignore`가 별도로 막고 있어 git에 커밋되지 않았음을 1단계 감사에서 확인했다.

**수정 방법**

- 루트 `.gitignore`를 올바른 멀티라인 형식으로 재작성한다(`uploads`, `.idea`, 로컬 secret 등 명시).
- 업로드 샘플과 `.idea/workspace.xml`을 Git index에서 제거한다.
- 운영 업로드 저장소를 배포 볼륨 또는 외부 저장소로 분리한다.

## P3-6. API 문서와 실제 구현 대조

**위치**

- `docs/api.md`
- `docs/architecture.md`
- `docs/세부기능 명세서.md`
- 각 Controller와 frontend API 호출부

**문제**

- 인증 헤더, 업로드 공개 여부, 응답 형식이 실제 구현과 다를 가능성이 있다.

**수정 방법**

- 실제 Controller와 프론트 호출을 기준으로 문서를 갱신한다.
- 오류 코드와 인증 요구사항을 명시한다.
- API 계약 변경 없이 문서만 정합화한다.

## P3-7. JWT httpOnly 쿠키 전환 (장기, P1에서 분리)

**위치**

- `frontend/src/context/AuthContext.jsx`
- `frontend/src/api/client.js`
- `backend/src/main/java/com/uninote/backend/security`

**문제**

- localStorage 기반 토큰 저장은 XSS에 취약한 근본 구조다. `P1-5`의 단기 완화책(CSP, 만료 검증, 로그아웃 경로 단일화)만으로는 근본적으로 해소되지 않는다.

**수정 방법**

- HttpOnly·Secure·SameSite 쿠키와 CSRF 대응(예: double-submit 쿠키)을 포함한 인증 아키텍처 전환을 별도 작업으로 설계·검토한다.
- 현재 API 계약과 인증 흐름에 미치는 영향을 먼저 문서화한 뒤 착수한다.
- 실제 필요성(위협 모델, 운영 환경)을 재확인한 뒤 착수한다 — 근거 없이 아키텍처를 바꾸지 않는다.

**검증**

- 전환 후에도 기존 로그인/로그아웃/보호된 API 호출 흐름이 그대로 동작

## P3-8. 프론트 lint 및 번들 (P2에서 하향)

**위치**

- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/editor/components/BlockHandle.jsx`
- `frontend/src/components/editor/components/IncorrectNoteModal.jsx`
- `frontend/src/components/editor/components/QuizAttemptsModal.jsx`
- `frontend/src/components/editor/components/QuizConfigModal.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/CourseContext.jsx`
- `frontend/vite.config.js`

**문제**

- 현재 lint에 22 errors, 2 warnings가 보고되었다.
- 미사용 import, effect dependency, Fast Refresh 규칙, Vite ESM 환경에서의 `__dirname` 사용 문제가 있다.
- 빌드는 성공하지만 큰 JavaScript chunk 경고가 있다.
- 런타임에는 영향이 없는 DX/빌드 경고 성격이라 P3로 내린다.

**수정 방법**

- lint 오류를 파일별로 하나씩 정리한다.
- 기존 동작 변경 없이 lazy loading은 실제 성능 측정 후 검토한다.

## P3-9. Spring Boot 기본 생성 보안 비밀번호 로그 (확인 완료, 정보성)

**위치**

- 앱 부팅 시 콘솔 (`UserDetailsServiceAutoConfiguration`), 코드 변경 없음

**문제**

- 부팅 로그에 "Using generated security password: ..."가 출력된다.

**확인 결과 (2026-09-15)**

- `JwtFilter`(`backend/src/main/java/com/uninote/backend/security/JwtFilter.java`)가 `Authorization: Bearer` 토큰을 직접 검증해 `SecurityContextHolder`에 `Authentication`을 주입한다. `AuthenticationManager`/`UserDetailsService`/`AuthenticationProvider`를 전혀 거치지 않는다.
- `SecurityConfig`는 `.httpBasic()`/`.formLogin()`을 호출하지 않는다. `SecurityFilterChain`을 빈으로 직접 정의하는 방식(Spring Security 6)에서는 명시적으로 호출한 설정만 필터 체인에 추가되므로, 기본 로그인 폼이나 HTTP Basic 인증 엔드포인트 자체가 존재하지 않는다.
- 즉 Spring Boot가 자동 생성하는 `InMemoryUserDetailsManager`와 그 비밀번호는 이 앱의 어떤 HTTP 요청 경로에서도 실제로 참조되지 않는다 — 로그는 `UserDetailsService` 빈이 없다는 조건에서 자동 설정이 켜졌다는 신호일 뿐, 도달 가능한 인증 경로가 아니다.
- 실 서버 `bootRun`으로 재현: 로그는 매 기동마다 출력되지만 JWT 기반 API 인증/인가 동작에는 아무 영향이 없음을 확인.

**판단**

- 보안 취약점 아님. 로그 노이즈에 불과하다.

**수정 방법**

- 로그를 숨기기 위한 목적만으로 더미 `UserDetailsService` 빈이나 `spring.autoconfigure.exclude`를 추가하지 않는다(요구사항).
- 필요해지면(예: 로그 정리 라운드) `NoOpUserDetailsService` 빈을 하나 등록해 자동 설정을 비활성화하는 것으로 충분하며, 그 전까지는 그대로 둔다.

**검증**

- 코드 변경 없음. 위 확인 내용을 근거로 문서화만 진행.

# 단계별 실행 순서

## 1단계: 기준선과 테스트 고정

1. 현재 `git status`와 변경 파일을 확인한다.
2. 루트 `.gitignore` 손상 여부를 확인하고, `git ls-files`로 `application-local.yaml` 등 다른 민감 파일이 이미 추적되고 있지 않은지 전수 확인한다(5분 내외의 감사 — 발견 시 즉시 별도 보고, 전체 정리는 5단계에서 진행).
3. Slash Command 정상 시나리오(특히 `/`, 필터링, ArrowUp/Down, **Enter 명령 실행**, 마우스 클릭, Escape)를 회귀 목록으로 고정한다.
4. 백엔드 `backend\gradlew.bat test`를 실행한다.
5. 프론트 `npm.cmd run lint`, `npm.cmd run build`를 실행해 기준 결과를 기록한다.
6. 노트·퀴즈·파일 API의 현재 응답 계약을 확인한다.

## 2단계: P0 권한과 인증 수정

수정 순서:

1. 예외 응답 상태 코드 중 소유권 위반(403) 매핑을 먼저 정리한다 — 기존 `CourseAccessException` 재사용, 또는 `P1-7`의 관련 부분을 여기서 함께 처리한다. 이후 항목들의 403 검증 기준을 만족시키기 위한 선행 작업이다.
2. 노트 소유권 검증 (`P0-2`)
3. 퀴즈 상세·풀이 소유권 검증 (`P0-3`)
4. 오답노트 그룹 소유권 검증 (`P0-5`)
5. 서버 점수 계산 및 문제 소속 검증 (`P0-4`)
6. 비밀번호 해시 전환 (`P0-1`)

각 항목마다:

```text
한 항목 수정
→ 관련 단위/통합 테스트 작성 및 실행 (P3-2로 미루지 않음)
→ 프론트 호출 회귀 확인
→ 다음 항목
```

## 3단계: P1 파일·환경·예외 경계 수정

수정 순서:

1. 파일 업로드·다운로드 인증 — 이미지/PDF가 브라우저 네이티브 요청이라 Authorization 헤더가 붙지 않는 문제를 먼저 설계(서명된 단기 URL / 세션 쿠키 / blob 방식 중 선택)한 뒤 인증을 적용한다 (`P1-1`)
2. 파일 MIME·크기·경로·확장자 검증 (`P1-2`)
3. 대시보드 게시글 범위 제한 (`P1-8`)
4. AI 입력 권한 (`P1-3`)
5. DB secret과 JWT secret 외부화 (`P1-6`, `P0-1`과 연계)
6. API origin과 파일 URL 환경화 (`P1-4`)
7. CORS 프로파일화 (`P1-4`)
8. JWT 저장 단기 완화 — CSP, 만료 검증, 로그아웃 경로 단일화 (`P1-5`)
9. 운영 DB 설정 분리 (`P1-6`)
10. 예외 상태 코드 분리 — 나머지 400/404 구분 마무리 (`P1-7`)

## 4단계: P2 데이터 일관성 및 성능

수정 순서:

1. 부모 노트와 게시판 수강 권한 (`P2-1`)
2. 자동 저장 JSON 파싱 보호 (`P2-4`)
3. 자동 저장 noteId 경쟁 상태 (`P2-4`)
4. 저장 실패 재시도 (`P2-4`)
5. 노트 조회 race 및 생성 중복 (`P2-5`)
6. 업로드 오류 UX (`P2-6`)
7. AI 요청 크기 제한 — 최소 구현 유지 (`P2-2`)
8. N+1 및 대량 응답 측정·개선 (`P2-3`)
9. 프론트 요청 중복 정리 — 새 라이브러리 추가 없이 (`P2-7`)

## 5단계: P3 정리와 테스트 확장

수정 순서:

1. DTO validation (`P3-1`)
2. 권한·API 계약 테스트 확장 — 2~3단계에서 이미 작성한 항목은 제외 (`P3-2`)
3. 미사용 Repository와 import 정리 (`P3-3`)
4. 중복 인증 사용자 조회 정리 (`P3-3`)
5. Context와 자동 저장 성능 개선 (`P3-4`)
6. 루트 `.gitignore` 재작성 및 tracked 산출물·업로드 파일 정리 (`P3-5`)
7. API 문서 갱신 (`P3-6`)
8. 프론트 lint 오류 정리 (`P3-8`)
9. JWT httpOnly 쿠키 전환 필요성 재검토 — 필요성이 확인될 때만 착수 (`P3-7`)
10. 필요한 경우에만 코드 분할

# 최종 검증 기준

## 보안·권한

- 사용자 간 노트·퀴즈·풀이·파일·오답노트 그룹 ID 교차 접근 차단
- 비밀번호와 secret 평문 저장·로그 제거
- 점수·정답 여부 서버 계산
- 업로드 MIME·경로·용량·확장자 검증
- 미수강 강의 게시글·노트가 대시보드·트리·게시판에 노출되지 않음
- 400/401/403/404 응답 의미 구분 (특히 소유권 위반 = 403)

## 기능 회귀

- Slash Command 전체 UX (Enter 명령 실행 포함, `priority: 1000` 유지)
- 이미지/PDF 업로드 command — 표시·다운로드까지 정상 동작 (`P1-1` 이후 특히 확인)
- 자동 저장 및 localStorage 복구
- 기존 노트 CRUD
- 게시판·댓글
- 퀴즈 생성·풀이·오답노트
- JWT 로그인과 만료 처리

## 명령

- `backend\gradlew.bat test`
- `frontend\npm.cmd run lint`
- `frontend\npm.cmd run build`

## 완료 조건

- P0 보안·권한 문제(오답노트 그룹 소유권 포함)가 해결되고, 소유권 위반이 실제로 403으로 응답하며, 관련 테스트가 존재한다.
- P1 배포 환경에서 secret·URL·CORS·파일 접근(이미지/PDF 정상 동작 포함)·대시보드 데이터 범위가 안전하게 동작한다.
- P2 데이터 경쟁 상태와 주요 성능 문제가 측정·개선되었다.
- P3 문서·테스트·저장소 위생(손상된 `.gitignore` 포함)이 정리되었다.
- 최근 Slash Command 정상 동작(Enter 포함)이 모든 단계에서 유지된다.
