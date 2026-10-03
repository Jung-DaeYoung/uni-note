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
| P1-2 잔여 | 초과 시 자동 축약 | rate limit은 이번 작업에서 완료, idempotency는 동시 생성 1건 제한으로 대신한다 |
| P1-3 | 비동기 생성 Job API | 선택·후순위 |
| P1-4 후속 | 프롬프트에 이전 문제 목록 넣기 | 이력 대비 정확 일치 검사·1회 재생성은 이번 작업에서 완료. 프롬프트 변경은 승인 필요 |
| P1-5 2단계 | `pdfBlock`에 BlockId 부여 | 노트 저장 형식 변경, 별도 승인 필요 |
| P2-1 | 학습 목표, `conceptTags` | |
| P2-2 잔여 | 인지 수준 저장 | 난이도별 프롬프트 기준은 이번 작업 B에서 완료. 인지 수준 저장은 DB 변경이라 보류 |
| P2-3 잔여 | 재시도 정답률, 개념별 정답률 | 출처 블록별 취약도는 이번 작업에서 완료. 개념별은 `conceptTags`(P2-1) 필요 |
| P2-4 | 오답 기반 재생성 모드 | |
| P2-5 | 객관식 선택지 품질 규칙 | |
| P2-6 잔여 | 동의어·허용 답안, 키워드, LLM 보조 채점 | 1차 정규화는 이번 작업 A에서 완료 |
| P3-1~3 | RAG, 원문 Snapshot, 품질 대시보드 | |
| §5 | 데이터 모델 확장 필드 전부 | 운영 `ddl-auto: validate`라 DDL 스크립트가 필요하다 |

## 직전 작업 (2026-10-03, 완료)

- `dec6a78` AI 생성 로그에 content hash·입력 글자 수, 200,000자 초과 거절 로그(`REJECTED_TOO_LONG`)
- `39ec9c5` 없는 경로 404, 허용되지 않은 메서드 405 (기존 `handleUnexpected`에서 `org.springframework.web.ErrorResponse` 분기)
- `bdc16cb` 풀이 저장 실패 시 결과 화면으로 넘어가지 않고 서버 `message` 안내
- `be8aaf9` AI 문제 생성 학생별 호출 제한: 동시 생성 1건, 10분에 5회, 초과 시 429 `TOO_MANY_REQUESTS`
- `3bcb74b` 이력 대비 중복 문제 재생성(P1-4): 같은 학생·같은 강의 최근 200문제와 정규화 후 정확 일치, 1회 재생성, 남으면 저장 후 `historyDuplicates` 로그
- `fef098c` 출처 블록별 취약도 API(`/api/quiz/incorrect/statistics/blocks`)와 `QuizConfigModal` "취약 블록 선택"
- `cfc85e6` 과잉 구현 리뷰 반영(이력 중복 계산의 빈 집합 분기 제거, 로그 메서드 주석 위치 복원)

## 이번 작업 (2026-10-03 완료)

작업 A와 B는 서로 독립이다. 각각 커밋한다.

### 작업 A. 주관식 채점 정규화 (P2-6 1차)

#### 현재

- 서버 `QuizService.isAnswerCorrect(submitted, correct)`와 프론트 `CBTPlayer.isCorrectAt(q, idx)`가 같은 규칙(trim + 소문자)으로 비교한다. 문제 유형은 구분하지 않는다.
- 프론트는 `isCorrectAt` 하나로 점수(`score`)와 결과 화면의 정답·오답 표시를 모두 판정한다. 저장되는 `UserAnswer.isCorrect`는 서버가 다시 채점한 값이다.
- 그래서 "운영 체제"와 "운영체제", "LRU."와 "LRU"가 오답으로 처리된다.

#### 규칙

주관식(`SHORT_ANSWER`)만 다음 순서로 정규화한 뒤 같으면 정답이다.

1. 소문자로 바꾼다.
2. 모든 공백 문자를 지운다.
3. 앞뒤 문장부호를 지운다: `. , ! ? ; : ' " “ ” ‘ ’ 。`

예: "운영 체제." = "운영체제", "  LRU! " = "lru". "C++"의 `+`나 "f(x)"의 괄호는 지우지 않는다.

객관식·OX는 기존 trim + 소문자를 유지한다. 보기 원문을 그대로 제출하므로 넓힐 이유가 없고, 넓히면 서로 다른 보기가 같아질 수 있다.

#### Backend

- `QuizService.isAnswerCorrect(QuestionType type, String submitted, String correct)`로 바꾸고 `saveAttempt`에서 `question.getType()`을 넘긴다.
- 정규화는 `isAnswerCorrect` 안의 private static 메서드 하나로 둔다. 다른 곳에서 쓰지 않으므로 별도 클래스를 만들지 않는다.
- `QuizQualityValidator`의 주석("비교 정규화는 채점 규칙과 같은 trim + 소문자 비교")을 "객관식 정답 매칭은 객관식 채점 규칙과 같은 trim + 소문자"로 고친다. 검증기의 동작은 바꾸지 않는다.

#### Frontend

- `CBTPlayer.isCorrectAt`에 같은 규칙을 넣는다(`q.type === 'SHORT_ANSWER'`일 때만). 서버 규칙과 함께 바꿔야 한다는 주석을 양쪽에 둔다.
- 결과 화면의 객관식 표시(`opt === q.correctAnswer`)는 그대로다.

#### 영향

- 이미 저장된 풀이 기록(`UserAnswer.isCorrect`)은 다시 채점하지 않는다. 오답 통계·복습 우선순위·취약 블록은 새 풀이부터 바뀐 규칙이 반영된다.
- 풀이 기록 다시 보기(`mode === 'report'`)는 서버가 저장한 `isCorrect`를 쓰므로 영향이 없다.
- API 요청·응답 형식은 바뀌지 않는다.

#### 한계

- 공백을 모두 지우므로 영어 "a b"와 "ab"가 같아진다. 주관식 정답은 대부분 짧은 용어라 허용한다.
- 동의어·허용 답안(2차), 키워드 포함(3차), LLM 보조 채점(4차)은 하지 않는다. 2차부터는 프론트가 서버 규칙을 복제할 수 없어 `POST /api/quiz/attempts` 응답 확장이 필요하다(`PLANS.md` P2-6).

#### 테스트

- `QuizServiceTest`
  - 주관식: 공백·대소문자·앞뒤 마침표만 다른 답은 정답
  - 주관식: 글자가 다른 답은 오답, 미응답(null)은 오답
  - 객관식: 공백이 섞인 보기 문자열은 기존처럼 trim + 소문자로만 비교
- `CBTPlayer.test.jsx`: 주관식에 "운영 체제."를 입력해 제출하면 결과 화면에서 정답으로 표시

### 작업 B. 난이도 기준 프롬프트 (P2-2)

프롬프트 변경이다. 사용자가 이 작업을 선택했으므로 명시적 요구로 보고 진행한다(AGENTS.md 외부 AI 연동 규칙).

#### 현재

- 프롬프트에는 `난이도: NORMAL.` 한 줄만 있고, 난이도별로 어떤 문제를 내야 하는지 기준이 없다.
- 저장되는 `QuizSet.difficulty`는 이미 요청값을 쓴다(`QuizQualityValidator`가 응답 difficulty를 요청값으로 덮어쓴다).

#### 변경

- `QuizAiGenerationService`에 `difficultyGuide(QuizDifficulty)` switch를 둔다. 모든 enum 값을 다루는 switch 식이라 값이 추가되면 컴파일 오류로 드러난다.

| 난이도 | 기준 문구 |
|---|---|
| EASY | 핵심 용어의 정의나 사실을 떠올리는 문제 |
| NORMAL | 개념을 설명하거나 두 개념을 비교하는 문제 |
| HARD | 사례에 개념을 적용하거나, 오류를 찾거나, 여러 개념을 엮어 추론하는 문제 |

- 프롬프트의 `"난이도: %s.\n"`을 `"난이도: %s. 문항은 %s로 출제하라.\n"`으로 바꾼다. 나머지 문구, 응답 schema, 응답 처리는 그대로다.
- `PROMPT_VERSION`을 `"2026-09-29.1"`에서 `"2026-10-03.1"`로 올린다. 생성 로그(`quiz.generation promptVersion=`)로 변경 전후 결과를 구분할 수 있다.
- 인지 수준(`REMEMBER`·`UNDERSTAND`·`APPLY`·`ANALYZE`) 저장은 `Question` 컬럼 추가와 운영 DDL이 필요해 하지 않는다(`PLANS.md` §5).

#### 테스트

- `QuizAiGenerationServiceTest.requestQuizPromptIsUnchanged`의 기대 문자열을 새 문구로 갱신한다. 이 테스트는 프롬프트가 의도치 않게 바뀌는 것을 막는 고정 테스트다.
- EASY·HARD 요청의 프롬프트에 각 기준 문구가 들어가는지 확인한다.

#### 수동 확인 (권장)

- 로컬 서버에서 같은 노트로 EASY·HARD를 한 번씩 생성해, 문항 성격이 기준대로 달라지는지 본다(Gemini API 키 필요).
- 단위 테스트는 프롬프트 문자열만 확인하며, 실제 AI 응답 품질은 확인하지 못한다.

### 검증 결과

- 작업 A (`eaf58e9`): `backend\gradlew.bat test` 258개, `npm run lint`·`build`·`test`(63개) 통과.
- 작업 B: `backend\gradlew.bat test` 259개 통과. 테스트 픽스처(`QuizAiGenerationServiceTest.simpleRequest`)가 `difficulty`를 비워 두고 있어 실제 요청처럼 NORMAL을 채웠다(`QuizRequest.difficulty`는 `@NotNull`).
- 실서버·실제 AI 응답으로는 확인하지 않았다. 난이도별 수동 확인(위)이 남아 있다.

### 수동 테스트와 후속 수정 (2026-10-03)

로컬 서버(`local` 프로필)와 실제 Gemini로 확인했다. 테스트 노트·퀴즈·풀이 기록은 모두 지웠다.

- 난이도 기준: 같은 노트로 EASY는 용어 회상(정답 "FIFO", "스래싱"), HARD는 사례 추론 문제가 나왔다. 로그 `promptVersion=2026-10-03.1`.
- 채점: "스 래 싱."과 "스래싱", "O P T 알 고 리 즘."과 "OPT 알고리즘"이 정답으로 채점됐다(4/4). 틀린 답 대조군은 0점이었다.
- 404: `/api/nope` → 404 `NOT_FOUND`.
- 발견 1: HARD 주관식 정답이 2~3문장 서술형으로 나와 정확 일치 채점으로는 맞힐 수 없었다.
  - 수정: 프롬프트 준수 사항 5번 "주관식 정답은 하나의 단어나 짧은 구(20자 이내)" 추가, `PROMPT_VERSION` `2026-10-03.2`.
  - 재확인: HARD 주관식 3문항 정답이 "LRU"(3자), "미래 참조 예측 불가능"(12자), "워킹 셋 모델"(7자)로 나왔다.
  - 남은 한계: "미래 참조 예측 불가능" 같은 구는 표현이 조금만 달라도 오답이다. 동의어·키워드 채점(P2-6 2·3차)이 필요하다.
- 발견 2: 255자를 넘는 답안은 `user_answers.submitted_answer`(VARCHAR 255) 초과로 409 "다른 데이터와 연결되어 있어…"가 났다(기존 문제).
  - 수정: `QuizAttemptRequest.UserAnswerRequest.submittedAnswer`에 `@Size(max = 255)` → 400 `VALIDATION_FAILED` "답안은 255자 이하로 입력해 주세요.", `CBTPlayer` 주관식 입력에 `maxLength={255}`.
  - 재확인: 256자 제출 → 400.
- 검증: `backend\gradlew.bat test` 260개, `npm run lint`·`build`·`test`(63개) 통과. 브라우저 화면은 확인하지 않았다.

## 다음 작업 (상세 계획은 착수 시 작성)

- P1-4 후속: 프롬프트에 이전 문제 목록 넣기 (승인 필요, `historyDuplicates` 빈도 확인 후).
- P1-1 노트 청킹은 보류한다. `REJECTED_TOO_LONG` 로그 빈도를 보고 결정한다.
