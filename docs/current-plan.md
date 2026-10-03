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

## 직전 작업 (2026-10-03, 완료)

- `dec6a78` AI 생성 로그에 content hash·입력 글자 수, 200,000자 초과 거절 로그(`REJECTED_TOO_LONG`)
- `39ec9c5` 없는 경로 404, 허용되지 않은 메서드 405 (기존 `handleUnexpected`에서 `org.springframework.web.ErrorResponse` 분기)
- `bdc16cb` 풀이 저장 실패 시 결과 화면으로 넘어가지 않고 서버 `message` 안내

## 이번 작업: AI 문제 생성 호출 제한 (P1-2 잔여, 2026-10-03 완료)

### 목표

`POST /api/quiz/generate`의 학생별 AI 호출을 제한해 비용과 중복 생성을 막는다. 현재는 노트 20개·총 30문항 상한만 있고 호출 빈도 제한이 없다. 프론트는 생성 중 버튼을 막지만(`QuizConfigModal`의 `loading`) 여러 탭이나 API 직접 호출은 막지 못한다.

### 상한 값

| 제한 | 값 | 근거 |
|---|---|---|
| 동시 생성 | 학생당 1건 | 한 번의 생성은 최대 약 90초(AI 호출 2회)다. 같은 학생이 동시에 둘을 돌릴 이유가 없고, 중복 제출·여러 탭에 의한 중복 생성을 막는다. idempotency key는 이것으로 대신한다. |
| 호출 빈도 | 학생당 10분에 5회 | 정상 사용(생성 → 풀이 → 다시 생성)은 한 번에 수 분이 걸려 5회에 닿기 어렵다. 반복 호출만 막는다. |

- 상수: `MAX_GENERATIONS_PER_WINDOW = 5`, `GENERATION_WINDOW = Duration.ofMinutes(10)`. 동시 생성 1건은 "진행 중 학생 집합"으로 표현하므로 상수가 없다.
- 강의별 제한은 두지 않는다. 학생별 제한으로 강의별 호출도 함께 묶인다.

### Backend

1. `exception/TooManyRequestsException` 추가 (`InvalidRequestException`과 같은 형태의 RuntimeException).
2. `GlobalExceptionHandler`에 핸들러 추가: 429, errorCode `TOO_MANY_REQUESTS`, message는 예외 메시지.
3. `QuizService`에 메모리 상태 2개를 둔다. 초기화된 `final` 필드라 `@RequiredArgsConstructor` 생성자와 `QuizServiceTest`의 생성자 호출은 바뀌지 않는다.
   - `Set<Long> generatingStudents = ConcurrentHashMap.newKeySet()`
   - `Map<Long, Deque<Instant>> recentGenerations = new ConcurrentHashMap<>()`
4. 적용 위치: `generateQuiz`에서 입력 검증(노트 접근·상한·블록 범위·빈 입력·200,000자)을 모두 통과한 뒤, AI 호출 직전에 검사한다. 입력 오류는 횟수를 쓰지 않는다.
   - 진행 중 집합에 `add` 실패 → 429 "이미 문제를 생성하고 있습니다. 완료된 뒤 다시 시도해 주세요."
   - 빈도 검사: 해당 학생의 deque에서 `clock.instant()` 기준 10분이 지난 항목을 지우고, 남은 개수가 5 이상이면 진행 중 집합에서 빼고 429 "문제 생성은 10분에 5회까지 할 수 있습니다. N분 후 다시 시도해 주세요." (N은 가장 오래된 항목 기준, 올림, 최소 1)
   - 통과하면 현재 시각을 deque에 추가한다. AI 호출이 실패해도 비용이 들었으므로 횟수에 포함한다.
   - 빈도 검사·추가는 학생별 deque에 `synchronized`로 묶는다.
   - AI 호출·검증·저장 전체를 `try/finally`로 감싸 진행 중 집합에서 반드시 뺀다.
5. 거절 시 로그 `quiz.generation status=RATE_LIMITED reason=CONCURRENT|WINDOW studId={}` 한 줄. 노트 본문은 남기지 않는다.
6. 한계는 `ponytail:` 주석으로 남긴다: 서버 1대 메모리 기준이며 재시작 시 초기화된다. 서버를 여러 대로 늘리면 Redis 등 공유 저장소로 옮긴다. 학생 수만큼 deque가 남지만 항목은 학생당 최대 5개다.

### Frontend

변경 없음. `QuizConfigModal`은 실패 시 서버 `message`를 alert로 보여주고, `client.js` 인터셉터는 401·403만 특별 처리한다.

### 테스트 (`QuizServiceTest`, `QuizControllerWebMvcTest`)

- 같은 학생 5회 성공 후 6번째 → `TooManyRequestsException`, AI 호출 없음.
- `clock`을 10분 뒤로 옮기면 다시 허용.
- 다른 학생은 영향 없음.
- 입력 오류(빈 노트 등)로 거절된 요청은 횟수에 포함되지 않음.
- AI 호출 실패(503)도 횟수에 포함되고, 실패 후 진행 중 상태가 풀려 다음 요청이 동시 생성 제한에 걸리지 않음.
- 동시 생성: 첫 요청의 `requestQuiz` mock 안에서 같은 학생으로 `generateQuiz`를 다시 호출 → 429. (스레드 없이 재진입으로 검증)
- WebMvc: `TooManyRequestsException` → 429, errorCode `TOO_MANY_REQUESTS`.

### 검증 결과

- `backend\gradlew.bat test` 통과 (248개, 신규 6개).
- 계획과 다른 점: 생성 시작 시각(`GenerationContext.start`)을 별도 `clock.instant()` 호출 대신 호출 제한 검사 시각으로 재사용한다. `clock` 호출 순서에 의존하는 기존 시간 예산 테스트를 그대로 유지하기 위해서다.
- 프론트 변경이 없어 프론트 검증은 생략했다. 실서버에서는 확인하지 않았다.

## 다음 작업 (상세 계획은 착수 시 작성)

- P1-4 이력 대비 중복 문제 제거. 결정 필요: 비교 범위(같은 노트 / 학생 전체 이력), 재생성 후에도 중복이 남을 때 실패 처리할지 해당 문항만 빼고 저장할지. 프롬프트에 기존 문제 목록을 넣는 방식은 프롬프트 변경이라 별도 승인이 필요하다.
- P2-3 일부: 기존 데이터(`UserAnswer`, `sourceBlockId`)로 유형별 정답률·출처 블록별 오답률.
- P1-1 노트 청킹은 보류한다. `REJECTED_TOO_LONG` 로그 빈도를 보고 결정한다.
