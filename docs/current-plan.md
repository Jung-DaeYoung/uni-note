# AI 퀴즈 생성 P0 마무리: DTO 제한 통일·schema 강화·생성 메타데이터 로그 (2026-09-29)

`PLANS.md` §6 구현 순서 5번 중 남은 P0-3(DTO 제한 통일, schema 강화)과 P0-4(생성 메타데이터 로그)를 한 작업 단위로 구현한다. 오류 코드 구분(P0-5)과 응답 difficulty 덮어쓰기(P0-3 일부)는 이전 작업(`36a6dd3`)에서 완료했다.

## 범위

포함:

- `QuizRequest.typeCounts` 제한을 `@Min(1) @Max(20)`으로 통일 (P0-3)
- Gemini response schema 강화: `type`·`difficulty` enum, `explanation` 필수, 출처 필드는 입력에 따라 필수 (P0-3)
- 모델명·prompt 버전 상수화, 원문 content hash, 생성 메타데이터 구조화 로그 (P0-4)

제외 (다음 작업):

- DB 컬럼 추가. 메타데이터 DB 저장은 PLANS.md §5 확장 시점에 스키마 변경 절차를 따른다.
- 프롬프트 문구 변경
- 블록 단위 범위 선택 (P1-5), 청킹 (P1-1)
- API 경로·성공 응답 필드 변경 없음

## 현재 코드 기준점

- `dto/QuizRequest.java`: `Map<QuestionType, @Min(0) @Max(50) Integer> typeCounts`
- `QuizService.validateGenerationLimits`: `MAX_QUESTIONS_PER_TYPE = 20`, 하한 1을 서비스에서 검증한다 (`INVALID_REQUEST` 400).
- 프론트 `QuizConfigModal`: 유형당 상한 20, `handleGenerate`는 활성화된 유형만 payload에 넣는다. 0이나 21 이상은 보내지 않는다.
- `QuizAiGenerationService.requestQuiz`의 schema: 문항 필수 필드는 `type`, `questionText`, `correctAnswer`뿐이고 enum이 없다. 모델명은 `API_URL` 문자열 안에 하드코딩되어 있다(`gemini-2.5-flash`).
- `QuizService.generateValidatedQuiz`: 요청당 AI 호출 최대 2회, 시도별 실패는 `log.warn`으로 남긴다. 요청 단위의 결과 로그는 없다.
- 로그: logback 기본 설정이며 구조화 로그 라이브러리(logstash encoder 등)가 없다. `key=value` 한 줄 로그를 쓴다.

## 구현 단계

### 1. `QuizRequest` 제한 통일 (P0-3)

- `@Min(0) @Max(50)`을 `@Min(1) @Max(20)`으로 바꾼다. 서비스 검증(`validateGenerationLimits`)은 방어선으로 그대로 둔다.
- 영향: 0이나 21~50을 담은 요청은 서비스 대신 DTO 검증에서 막힌다. errorCode가 `INVALID_REQUEST`에서 `VALIDATION_FAILED`로 바뀌고 상태는 둘 다 400이다. 프론트는 이 범위를 보내지 않는다.

### 2. Gemini schema 강화 (`QuizAiGenerationService.requestQuiz`, P0-3)

- 문항 `type`에 `"enum": ["MULTIPLE_CHOICE", "SHORT_ANSWER", "OX"]`, 최상위 `difficulty`에 `"enum": ["EASY", "NORMAL", "HARD"]`를 추가한다. 값은 `QuestionType.values()`, `QuizDifficulty.values()`로 만들어 enum 정의와 어긋나지 않게 한다.
- 문항 `required`에 `explanation`을 추가한다.
- `sourceNoteId`, `sourceBlockId`는 `input.allowedSources()`가 비어 있지 않을 때만 `required`에 넣는다. 미디어만 있어 REF가 하나도 없는 입력에서 출처를 강제하면 모델이 출처를 지어내기 때문이다.
- `options`는 객관식에만 필요한데 schema로 조건부 필수를 표현할 수 없다. `QuizQualityValidator` 검증에 맡긴다.
- **프롬프트 문자열은 변경하지 않는다.** 서버 검증(`QuizQualityValidator`)은 최종 방어선으로 유지한다.
- 이 schema 변경의 근거는 PLANS.md P0-3이다. 변경된 schema는 테스트로 고정한다.

### 3. 모델명·prompt 버전 상수화 (P0-4)

- `QuizAiGenerationService`에 `public static final String MODEL_NAME = "gemini-2.5-flash"`와 `PROMPT_VERSION`(예: `"2026-09-29.1"`)을 둔다. `PROMPT_VERSION`은 prompt와 schema를 함께 가리킨다.
- `API_URL`은 `MODEL_NAME`으로 조립한다. 최종 URL 값은 바뀌지 않는다.
- prompt나 schema를 바꿀 때마다 `PROMPT_VERSION`을 올린다는 주석을 단다.

### 4. 원문 content hash (P0-4)

- `QuizGenerationInput`에 `contentHash()` 메서드를 추가한다. 입력 텍스트와 각 미디어 part의 `inline_data.data`를 순서대로 SHA-256(`java.security.MessageDigest`)으로 해시하고 hex 문자열로 반환한다. 새 라이브러리는 추가하지 않는다.
- record 필드는 바꾸지 않는다. 기존 테스트의 생성자 호출은 그대로 동작한다.

### 5. 생성 메타데이터 구조화 로그 (`QuizService`, P0-4)

- 입력 준비가 끝난 뒤의 AI 생성 흐름에서는 성공이든 실패든 요청당 정확히 한 줄의 `log.info`를 남긴다.

  ```text
  quiz.generation status=SUCCESS|FAILED model=… promptVersion=… contentHash=… attempts=… regenerated=true|false unverified=… elapsedMs=… failureCode=… failureReason=… quizSetId=… studId=…
  ```

  - 생성 시각은 로그 타임스탬프로 대신한다. `elapsedMs`는 주입된 `Clock`으로 잰다.
  - 검증 상태는 `status`와 `unverified`로 표현한다. 재생성 여부는 `attempts`와 `regenerated`로 표현한다.
  - `failureCode`는 `ExternalServiceException.getErrorCode()`를 쓴다. `failureReason`은 마지막 검증 사유나 예외 메시지다. 성공 시 두 값은 비운다.
- `generateValidatedQuiz`의 반환값을 응답, 시도 횟수, 미검증 수를 담는 private record로 바꿔 성공 로그에 쓴다. 성공 로그는 저장 후 `quizSetId`와 함께 남긴다.
- 실패 로그는 예외를 던지기 직전에 남긴다. 재생성 없이 바로 전파되는 `EXTERNAL_SERVICE_ERROR`도 포함한다.
- 노트 본문, 문제 텍스트, 학번 같은 개인정보는 로그에 넣지 않는다. 사용자 식별자는 내부 `studId`만 쓴다.
- 기존 시도별 `log.warn`과 예외 흐름·응답은 그대로 둔다.

## 수정 대상 파일

- `backend/src/main/java/com/uninote/backend/dto/QuizRequest.java`
- `backend/src/main/java/com/uninote/backend/service/QuizAiGenerationService.java`
- `backend/src/main/java/com/uninote/backend/service/QuizGenerationInput.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- 테스트: `QuizControllerWebMvcTest`, `QuizAiGenerationServiceTest`, `QuizServiceTest`

## 기존 테스트 영향

- `QuizControllerWebMvcTest.typeCounts값이음수이면400을반환한다`: 그대로 통과한다(-1은 여전히 `@Min` 위반).
- `QuizServiceTest`의 한도 초과 테스트는 서비스를 직접 호출하므로 영향이 없다.
- `MODEL_NAME`, `PROMPT_VERSION`은 static 상수라 `QuizServiceTest`의 `quizAiGenerationService` mock에 추가 stub이 필요 없다.
- 프론트 `QuizConfigModal.test.jsx` payload(`MULTIPLE_CHOICE: 2, OX: 2, SHORT_ANSWER: 1`)는 새 범위 안이다.

## 추가 테스트

`QuizControllerWebMvcTest`:

- typeCounts 0 → 400 `VALIDATION_FAILED`
- typeCounts 21 → 400 `VALIDATION_FAILED`
- typeCounts 20 → DTO 검증 통과(서비스 호출됨)

`QuizAiGenerationServiceTest` (`RestTemplate`에 전달된 request body 캡처):

- `type`·`difficulty` enum 값
- `explanation`이 필수에 포함됨
- REF가 있는 입력은 출처 필드가 필수, REF가 없는 입력(미디어만)은 출처 필드가 필수가 아님
- prompt 텍스트가 이전과 동일함
- `QuizGenerationInput.contentHash()`: 같은 입력이면 같은 해시, 텍스트나 미디어가 다르면 다른 해시

`QuizServiceTest` (`OutputCaptureExtension`으로 결과 로그 확인):

- 성공 시 `status=SUCCESS` 한 줄, `attempts=1`
- 재생성 후 성공 시 `attempts=2 regenerated=true`
- 최종 실패 시 `status=FAILED failureCode=QUIZ_VALIDATION_FAILED`
- 호출 실패 시 `status=FAILED failureCode=EXTERNAL_SERVICE_ERROR`

## 검증

```powershell
backend\gradlew.bat test
```

프론트 코드는 변경하지 않는다. 다만 요청 제한이 바뀌므로 필요하면 `npm run test`로 `QuizConfigModal.test.jsx` 회귀를 확인한다.

수동 확인:

1. 로컬에서 정상 생성을 1회 하고, 서버 로그의 `quiz.generation status=SUCCESS` 한 줄에 모든 필드가 채워졌는지 확인한다.
2. 생성된 문제의 유형·해설·원문 이동이 기존처럼 동작한다.

## 이전 작업(2026-09-28) 미확인 항목

- OSIV(`spring.jpa.open-in-view` 기본값 true) 상태에서 AI 호출 동안 DB 커넥션이 반환되는지 확인하고 결과만 기록한다. 설정 변경은 범위 밖이다.
- 수동 확인 4개(정상 생성 후 원문 이동, 빈 노트 alert, 출처 null 문항의 "원문 보기" 숨김, 오답노트·오늘의 복습 원문 이동)는 사용자가 확인 중이다.

## 완료 기준

- 유형당 문항 수 0이나 21 이상은 DTO 단계에서 400 `VALIDATION_FAILED`가 된다.
- schema가 유형·난이도를 enum으로 제한하고, 해설과 (REF가 있는 입력이면) 출처를 필수로 요구한다. prompt 문구는 변경되지 않는다.
- 모든 AI 생성 요청이 모델명, prompt 버전, content hash, 시도 횟수, 결과, 실패 사유를 담은 로그 한 줄을 남긴다.
- DB 스키마, API 경로, 성공 응답 필드는 변경되지 않는다.
