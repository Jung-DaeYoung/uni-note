# PLANS.md 구현 현황 (2026-10-03, 코드 대조 기준)

`PLANS.md`의 각 항목을 실제 코드·커밋과 대조해 완료 여부를 정리했다. 다음 작업 선정의 기준으로 쓴다.

## 완료

- P0-1 `QuizQualityValidator` 도입, AI 호출의 트랜잭션 분리, 재생성 최대 2회·30초 예산 (`36a6dd3`)
- P0-2 출처 허용 집합 검증, 허용 집합 밖 출처는 null(미검증)로 저장
- P0-3 JSON schema 강화, `QuizRequest`의 `@Min(1) @Max(20)` 통일, 응답 difficulty를 요청값으로 덮어쓰기 (`e88c237`)
- P0-4 구조화 로그 `quiz.generation ...` (모델명·promptVersion·시도 횟수·미검증 수·실패 사유). content hash·입력 글자 수는 이번 작업 1에서 추가했다.
- P0-5 errorCode 3종(`EXTERNAL_SERVICE_ERROR`, `AI_RESPONSE_INVALID`, `QUIZ_VALIDATION_FAILED`) 구분, 프론트가 서버 `message`를 표시
- P1-5 블록 단위 범위 선택 (`394debb`). 여러 노트의 블록을 선택하도록 확장했다 (`c70b200`).
- P1-2 일부: 추출 텍스트 200,000자 상한(`QuizService.MAX_INPUT_TEXT_CHARS`), 초과 시 AI 호출 없이 400 (`d719207`)

## 미구현

| 항목 | 내용 | 비고 |
|---|---|---|
| P1-1 | 노트 청킹, 핵심 개념 추출, 중요도 정렬 | |
| P1-2 잔여 | idempotency, rate limit, 초과 시 자동 축약 | 텍스트 상한은 완료(위) |
| P1-3 | 비동기 생성 Job API | 선택·후순위 |
| P1-4 | 이력 대비 중복 문제 제거 | 현재 같은 세트 안 정확 일치만 검사한다 |
| P1-5 2단계 | `pdfBlock`에 BlockId 부여 | 노트 저장 형식 변경, 별도 승인 필요 |
| P2-1 | 학습 목표, `conceptTags` | |
| P2-2 | 난이도별 생성 기준, 인지 수준 | |
| P2-3 | 취약 지표 (유형별·출처 블록별 정답률 등) | |
| P2-4 | 오답 기반 재생성 모드 | |
| P2-5 | 객관식 선택지 품질 규칙 | |
| P2-6 | 주관식 채점 개선 | 현재 trim·소문자 비교만 한다 |
| P3-1~3 | RAG, 원문 Snapshot, 품질 대시보드 | |
| §5 | 데이터 모델 확장 필드 전부 | 운영 `ddl-auto: validate`라 DDL 스크립트가 필요하다 |

## 이번 작업 (2026-10-03, 완료)

작업 1~3을 모두 반영했다. 커밋은 작업 단위로 나눈다.

### 작업 1. P0-4 마무리: content hash·입력 길이 로그

- `QuizService.generateQuiz`에서 `input.text()`의 SHA-256 hex를 한 번 계산해 `GenerationContext`에 `contentHash` 필드로 넣는다.
  - `HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(UTF_8)))`. 표준 라이브러리만 쓴다.
- `logGenerationResult`에 `contentHash={} textChars={}`를 추가한다. 성공·실패 로그 모두에 남는다.
- 200,000자 초과로 거절할 때 `quiz.generation status=REJECTED_TOO_LONG textChars={} studId={}` 한 줄을 남긴다. P1-1 착수 여부를 판단할 빈도 측정용이다.
- 테스트: `generateQuizLogsOneSuccessLineWithGenerationMetadata`에 `contentHash=` 단언을 추가하고, `generateQuizRejectsTooLongInputTextWithoutCallingAi`에 로그 단언을 추가한다.

### 작업 2. 잘못된 경로·메서드가 500으로 응답되는 문제

- 원인: `GlobalExceptionHandler.handleUnexpected(Exception)`이 `NoResourceFoundException`(404), `HttpRequestMethodNotSupportedException`(405)까지 잡는다.
- 수정: `handleUnexpected`에서 예외가 `org.springframework.web.ErrorResponse`(Spring이 상태 코드를 가진 웹 예외에 붙이는 인터페이스)이면 그 `getStatusCode()`로 응답한다. `@ExceptionHandler`는 인터페이스 타입을 받지 않아 별도 핸들러 대신 분기로 처리했다. 프로젝트의 `ErrorResponse` DTO와 이름이 겹치므로 FQN으로 쓴다.
  - errorCode는 `HttpStatus.name()`(예: `NOT_FOUND`, `METHOD_NOT_ALLOWED`), message는 고정 한국어 문구다.
  - 기존 전용 핸들러(`MethodArgumentNotValidException`, `MaxUploadSizeExceededException`)는 더 구체적인 타입이라 그대로 우선한다.
- 테스트: 기존 WebMvc 테스트 방식(`QuizControllerWebMvcTest`)으로 없는 경로 → 404, 잘못된 메서드 → 405를 확인한다.

### 작업 3. 풀이 저장 실패가 제출 완료로 보이는 문제

- `CBTPlayer.handleSubmit`의 catch에서 `setSubmitted(true)`를 지우고, 서버 `message`(없으면 "풀이 결과를 저장하지 못했습니다. 다시 시도해 주세요.")를 alert로 보여준다. 답안은 유지되므로 다시 제출할 수 있다.
- 화면 동작 변경이다(`PLANS.md` §8의 별도 과제). 401은 `client.js` 인터셉터 처리를 그대로 따른다.
- 테스트: `CBTPlayer.test.jsx`에 저장 실패 시 결과 화면으로 넘어가지 않는 케이스를 추가한다.

### 검증 결과

- 작업 1·2: `backend\gradlew.bat test` 통과 (242개).
- 작업 3: `npm run lint`, `npm run build`, `npm run test`(60개) 통과.
- 실서버·브라우저에서는 확인하지 않았다.

## 다음 작업 (상세 계획은 착수 시 작성)

- `PLANS.md` §6 8번: P1-2 rate limit, P1-4 이력 대비 중복 제거.
- P1-1 노트 청킹은 보류한다. 200,000자 상한과 블록 범위 선택으로 입력 크기는 막혀 있다. 작업 1의 `REJECTED_TOO_LONG` 빈도를 보고 결정한다.
