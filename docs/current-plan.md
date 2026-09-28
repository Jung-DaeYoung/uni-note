# AI 퀴즈 생성 결과 검증 1차 구현 계획 (2026-09-28)

`PLANS.md` §6 구현 순서 1~4번과 P0-5를 한 작업 단위로 구현한다. AI가 반환한 문제를 저장하기 전에 형식·의미·출처를 검증하고, 실패하면 1회만 재생성하며, 실패가 조용한 성공처럼 보이지 않게 한다.

## 범위

포함:

- `QuizQualityValidator` 신설과 단위 테스트 (§6-1, 2)
- 출처 노트·블록 정합성 검증, 미검증은 출처 null 처리 (§6-3, P0-2)
- AI 호출을 트랜잭션 밖으로 분리하고 재생성 1회 정책 적용 (§6-4)
- 문항 0개 응답·빈 입력·노트 파싱 실패의 명시적 오류화
- AI 오류와 검증 실패의 errorCode 구분, 프론트 실패 메시지 표시 (P0-5)
- 응답 difficulty를 요청값으로 덮어쓰기 (P0-3 일부)

제외 (다음 작업):

- `QuizRequest` `@Min(1) @Max(20)` 통일, Gemini schema 필수 필드 강화 (P0-3 나머지)
- 생성 메타데이터·prompt 버전 로그 (P0-4)
- 블록 단위 범위 선택 (P1-5), 청킹 (P1-1)
- DB 컬럼 추가 없음. API 경로·성공 응답 필드 변경 없음.

## 현재 코드 기준점

- `QuizService.generateQuiz` (`@Transactional`): 노트 조회 → 소유권·강의·제한 검증 → `QuizAiGenerationService.generateQuizContent` → 문항이 있으면 저장, 0개면 `quizSetId = null`로 200 반환.
- `QuizAiGenerationService.generateQuizContent`: Tiptap JSON 순회(`extractDataFromNode`)로 텍스트와 `[[REF:noteId/blockId]]`, 미디어 part를 만들고 Gemini를 호출·파싱한다. 노트 파싱 실패는 `processNoteContent`에서 `log.warn` 후 무시한다.
- `ExternalServiceException(String)` → `GlobalExceptionHandler`에서 항상 503 `EXTERNAL_SERVICE_ERROR`.
- 프론트 `QuizConfigModal.handleGenerate`는 실패 시 고정 문구 alert를 띄운다. `CBTPlayer`는 `sourceBlockId`가 없으면 "원문 보기" 버튼을 숨긴다.

## 구현 단계

### 1. `ExternalServiceException` errorCode 추가 (P0-5)

- `exception/ExternalServiceException.java`에 `errorCode` 필드를 추가한다.
  - 기존 생성자 `(String message)`는 errorCode `EXTERNAL_SERVICE_ERROR`로 유지한다. 기존 호출부는 변경하지 않는다.
  - 새 생성자 `(String errorCode, String message)`를 추가한다.
- `GlobalExceptionHandler.handleExternalService`는 `ex.getErrorCode()`를 사용한다. HTTP 상태는 503으로 유지한다.
- 사용 코드:
  - `EXTERNAL_SERVICE_ERROR`: Gemini 호출 실패·타임아웃 (`RestClientException`)
  - `AI_RESPONSE_INVALID`: AI 응답 JSON 해석·구조 오류 (`extractGeneratedText`, `readValue` 실패)
  - `QUIZ_VALIDATION_FAILED`: 재생성 후에도 검증 실패

### 2. `QuizAiGenerationService` 입력 준비와 호출 분리

재생성 시 노트 파싱·미디어 파일 읽기를 반복하지 않고, 출처 허용 집합을 검증기에 넘기기 위해 분리한다.

- 새 record `service/QuizGenerationInput`: `String text`, `List<Map<String, Object>> mediaParts`, `Map<Long, Set<String>> allowedSources`
- `prepareInput(List<Note>, Student)` → `QuizGenerationInput`
  - `extractDataFromNode`가 `[[REF:noteId/blockId]]`를 붙일 때 같은 쌍을 `allowedSources`에 추가한다. 이 집합이 P0-2의 허용 집합이다.
  - `processNoteContent`의 노트 파싱 실패는 `log.warn` 후 무시하지 않는다. `InvalidRequestException("노트 내용을 읽을 수 없습니다: noteId=...")`(400)으로 던진다.
  - 빈 입력 판정은 `QuizGenerationInput.isEmpty()`로 제공하고, `QuizService`가 AI 호출 전에 `InvalidRequestException("문제를 생성할 노트 내용이 없습니다.")`(400)을 던진다. 추출 결과(미디어 소유권 필터 등)를 테스트에서 직접 확인할 수 있도록 `prepareInput`은 예외를 던지지 않는다.
- `requestQuiz(QuizRequest, QuizGenerationInput)` → `QuizResponse`
  - 기존 prompt 문자열, response schema, Gemini 호출·파싱 코드를 그대로 옮긴다. **프롬프트와 schema 내용은 변경하지 않는다.**
  - 호출 실패는 `EXTERNAL_SERVICE_ERROR`, 해석 실패는 `AI_RESPONSE_INVALID` errorCode로 던진다.
- 기존 `generateQuizContent`는 제거하고 테스트를 두 메서드 기준으로 옮긴다.

### 3. `QuizQualityValidator` 신설 (`service/QuizQualityValidator.java`, `@Component`)

`validate(QuizResponse response, QuizRequest request, Map<Long, Set<String>> allowedSources)` → 결과 객체(`valid`, 실패 사유 목록, 미검증 문항 수). 통과한 경우 `response`를 저장 가능한 형태로 정규화한다.

정규화 규칙은 채점 규칙과 같게 한다: `trim()` + `toLowerCase()` (`QuizService.isAnswerCorrect`, `CBTPlayer.jsx`와 동일).

치명 오류 (재생성 대상):

1. 문항 0개
2. 총 문항 수 ≠ 요청 총합, 유형별 문항 수 ≠ `typeCounts`
3. 문항별 `type` null, `questionText` 공백, `correctAnswer` 공백
4. `correctAnswer` 255자 초과 (`Question.correctAnswer` 기본 VARCHAR(255))
5. 객관식: 보기 2개 미만, 정규화 기준 보기 중복, 정답과 정규화 일치하는 보기 없음
6. OX: 정답을 대문자로 정규화한 값이 `O`/`X`가 아님
7. 같은 세트 안에서 정규화한 `questionText`가 중복
8. 미검증 문항이 전체의 절반 초과 (기준값은 상수 `MAX_UNVERIFIED_RATIO = 0.5`)

정규화 (통과 시 적용):

- 객관식 `correctAnswer`를 일치한 보기의 원문으로 덮어쓴다. 결과 화면 정답 표시가 `opt === q.correctAnswer` 정확 일치를 요구하기 때문이다.
- OX `correctAnswer`를 `O`/`X` 대문자로 저장한다.
- 출처: `(sourceNoteId, sourceBlockId)`가 `allowedSources`에 없으면 두 필드를 모두 null로 바꾸고 미검증으로 센다.
- `title`이 255자를 넘으면 255자로 자르고, 공백이면 `"AI 생성 퀴즈"`로 채운다. 제목 때문에 생성 전체를 실패시키지 않는다.
- `difficulty`를 `request.getDifficulty()`로 덮어쓴다.
- 해설(`explanation`)은 비어 있어도 허용한다. 컬럼이 nullable이며 현재 화면도 해설 없이 동작한다.

### 4. `QuizService.generateQuiz` 흐름 변경

1. 노트 조회, `validateNoteAccess`, `validateGenerationLimits`: 기존과 동일
2. `input = quizAiGenerationService.prepareInput(...)`
3. AI 호출과 검증 (최대 2회):
   - 1회차 `requestQuiz` → `validator.validate`
   - 통과하면 저장 단계로 간다.
   - 실패 사유가 검증 실패이거나 `AI_RESPONSE_INVALID`이고, 1회차 소요시간이 30초 이하이면 1회만 재생성한다.
   - `EXTERNAL_SERVICE_ERROR`(호출 실패·타임아웃)는 재생성하지 않고 그대로 던진다.
   - 2회차도 실패하면 `ExternalServiceException(QUIZ_VALIDATION_FAILED, "요청한 조건에 맞는 문제를 생성하지 못했습니다. 범위나 문항 수를 조정해 주세요.")`를 던진다. 저장하지 않는다.
   - 각 실패 사유는 `log.warn`으로 남긴다.
4. 저장: 통과한 응답만 기존 저장 코드로 저장한다. `QuizSet`·`Question` 필드 매핑은 그대로다.

트랜잭션 분리:

- `generateQuiz`에서 `@Transactional`을 제거한다. 저장 부분만 트랜잭션으로 묶는다.
- 같은 클래스 내부 호출은 프록시를 타지 않으므로, 저장은 `TransactionTemplate`으로 감싼다. 새 서비스 클래스를 만들지 않는다.
- **확인 필요:** `spring.jpa.open-in-view`가 설정되어 있지 않아 기본값(true)이다. OSIV 상태에서는 트랜잭션을 분리해도 요청이 끝날 때까지 DB 커넥션이 반환되지 않을 수 있다. 구현 후 로그나 커넥션 풀 지표로 확인하고, 반환되지 않으면 결과만 보고한다. OSIV 설정 변경은 이번 범위가 아니다.
- 노트의 `course`는 LAZY 로딩이다. 트랜잭션 밖 접근은 OSIV 덕분에 동작하므로 기존과 같다.

시간 측정:

- 테스트에서 시간을 제어할 수 있도록 `java.time.Clock`을 주입한다. 현재 `Clock` 빈이 없으므로 `config`에 `Clock.systemDefaultZone()` 빈을 추가한다.

재생성 기준 30초: read timeout이 60초라 재생성 1회에 최대 60초가 더 걸린다. 총 90초 예산을 지키려면 1회차가 30초 이하일 때만 재생성해야 한다. PLANS.md도 같은 기준으로 맞췄다.

### 5. 프론트 실패 메시지 표시 (P0-5)

- `frontend/src/components/editor/components/QuizConfigModal.jsx`의 `handleGenerate` catch에서 `error.response?.data?.message`가 있으면 그 문구를, 없으면 기존 문구 "문제 생성 중 오류가 발생했습니다."를 alert로 표시한다.
- 요청 payload, 로딩 상태, `onGenerated` → `onClose` 순서는 변경하지 않는다.
- 401/403 처리는 `client.js` 인터셉터에 그대로 맡긴다.

## 수정 대상 파일

- `backend/src/main/java/com/uninote/backend/exception/ExternalServiceException.java`
- `backend/src/main/java/com/uninote/backend/exception/GlobalExceptionHandler.java`
- `backend/src/main/java/com/uninote/backend/service/QuizAiGenerationService.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- 신규: `service/QuizGenerationInput.java`, `service/QuizQualityValidator.java`, `config/ClockConfig.java`
- `frontend/src/components/editor/components/QuizConfigModal.jsx`
- 테스트: `QuizServiceTest`, `QuizAiGenerationServiceTest`, 신규 `QuizQualityValidatorTest`, `QuizControllerWebMvcTest`, `QuizConfigModal.test.jsx`

## 기존 테스트 영향 (의도된 변경)

- `QuizServiceTest.generateQuiz*` 성공 테스트는 AI가 빈 문항을 반환하는 mock으로 성공을 기대한다. 이 동작은 이번 작업에서 오류로 바뀌므로, mock 응답을 요청 수에 맞는 유효 문항으로 바꾼다. 거부 테스트(소유권·강의·제한)는 AI 호출 전에 실패하므로 기대값이 그대로다.
- `QuizService` 생성자에 `QuizQualityValidator`, `Clock`, `TransactionTemplate`이 추가되어 테스트의 수동 생성 코드를 고친다.
- `QuizAiGenerationServiceTest`는 빈 문서(`{"type":"doc","content":[]}`)를 쓴다. 빈 입력은 이제 AI 호출 전에 400이 되므로, 텍스트가 있는 문서로 바꾸고 `prepareInput`/`requestQuiz` 기준으로 옮긴다. 미디어 소유권 테스트의 기대값은 유지한다.

## 추가 테스트

`QuizQualityValidatorTest` (단위):

- 정상 응답 통과, difficulty 덮어쓰기
- 총 문항 수·유형별 수 불일치
- 객관식: 보기 부족, 보기 중복, 정답 없음, 대소문자·공백만 다른 정답은 보기 원문으로 치환
- OX: `o` → `O` 정규화, `참` 등은 실패
- 정답 255자 초과, 세트 내 중복 문항
- 출처 위조(요청 외 noteId, 없는 blockId)는 null 처리, 미검증 절반 초과는 실패
- 제목 공백·255자 초과 처리

`QuizServiceTest`:

- 1회차 검증 실패 → 2회차 성공 시 저장, AI 호출 2회
- 2회차도 실패 → `QUIZ_VALIDATION_FAILED`, 저장 없음
- 1회차 30초 초과(Clock 제어) → 재생성 없이 실패
- `EXTERNAL_SERVICE_ERROR` → 재생성 없이 전파
- `AI_RESPONSE_INVALID` → 재생성

`QuizAiGenerationServiceTest`:

- `allowedSources`에 REF를 붙인 `noteId/blockId`만 담긴다.
- 빈 입력은 AI 호출 없이 400이다. 노트 JSON이 깨졌으면 400이다.
- 호출 실패와 해석 실패의 errorCode가 다르다.

`QuizControllerWebMvcTest`: errorCode별 503 응답 본문 확인.

`QuizConfigModal.test.jsx`: 서버 `message` alert 표시, 메시지가 없으면 기존 문구, 성공 payload 불변.

## 검증

```powershell
backend\gradlew.bat test
cd frontend
npm run lint
npm run build
npm run test
```

수동 확인:

1. 정상 노트로 생성 → 문제 풀이 → 원문 보기 이동이 기존처럼 동작한다.
2. 빈 노트로 생성하면 400 메시지가 alert로 보인다.
3. 출처가 null인 문항은 "원문 보기" 버튼이 숨겨지고 풀이·오답노트 등록은 정상이다.
4. 오답노트·오늘의 복습의 원문 이동에 회귀가 없다.

## 완료 기준

- 검증을 통과한 문제만 저장되고, 요청 문항 수·유형 수와 저장 문항 수가 일치한다.
- 저장된 출처는 실제로 REF를 붙인 블록이거나 null이다.
- 문항 0개, 빈 입력, 노트 파싱 실패, 재생성 실패가 200 성공으로 보이지 않는다.
- AI 호출은 요청당 최대 2회다.
- 기존 API 경로, 성공 응답 필드, DB 스키마, 프롬프트·schema 내용이 변경되지 않는다.
