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
- `be8aaf9` AI 문제 생성 학생별 호출 제한: 동시 생성 1건, 10분에 5회, 초과 시 429 `TOO_MANY_REQUESTS`

## 이번 작업: 이력 대비 중복 문제 제거 (P1-4, 2026-10-03 완료)

### 목표

같은 학생이 같은 강의에서 이미 받은 문제와 문장이 같은 문제를 다시 만들지 않도록 한다. 현재는 같은 세트 안의 정확 일치만 검사한다(`QuizQualityValidator`).

### 결정 사항

- 비교 범위: 같은 학생·같은 강의의 최근 문제 200개. 출처가 null(미검증)인 문제도 포함하기 위해 노트가 아닌 강의 기준으로 묶는다.
- 판정: 기존 세트 내 중복과 같은 정규화(trim·소문자) 후 정확 일치. 유사 문항 판정은 하지 않는다.
- 처리: 중복이 있으면 1회 재생성한다. 재생성 후에도 남으면 실패시키지 않고 저장하며 중복 수를 로그에 남긴다. 실패 처리는 짧은 노트로 반복 생성하는 사용자를 막고, 중복 문항만 빼면 요청 문항 수 일치 기준(`PLANS.md` §8)이 깨진다.
- 프롬프트는 바꾸지 않는다. 이전 문제 목록을 프롬프트에 넣는 방식은 별도 승인 전까지 보류한다(아래 한계 참고).

### Backend

1. `QuestionRepository`에 조회 추가 (스키마 변경 없음):
   ```java
   @Query("SELECT q.questionText FROM Question q WHERE q.quizSet.student.studId = :studId "
        + "AND q.quizSet.course.courseId = :courseId ORDER BY q.quizSet.createdAt DESC, q.questionId DESC")
   List<String> findRecentQuestionTexts(Long studId, Long courseId, Pageable pageable);
   ```
   호출은 `PageRequest.of(0, RECENT_QUESTION_HISTORY_SIZE)`, 상수는 `QuizService`에 `200`.
2. `QuizQualityValidator.normalize`를 package-private static으로 열어 재사용한다. 비교 규칙이 한 곳에만 있게 한다.
3. `QuizService.generateQuiz`: 호출 제한 통과 후, AI 호출 전에 이력 문장 집합(정규화)을 한 번 조회한다. 강의는 `notes.get(0).getCourse()`(같은 강의 검증을 이미 통과함). 트랜잭션 밖 단순 조회다.
4. `generateValidatedQuiz`에 이력 집합을 넘긴다. `quizQualityValidator.validate`가 통과한 뒤:
   - 이력 중복 수를 센다.
   - 0이면 그대로 반환한다.
   - 1 이상이고 재생성 가능(시도 < 2, 경과 ≤ 30초)하면 이 결과를 "대체 결과"로 보관하고 재생성한다.
   - 재생성 불가면 중복이 있는 채로 반환한다.
   - 재생성 결과가 검증 실패이거나 AI 오류(`AI_RESPONSE_INVALID`)면 보관한 대체 결과를 반환한다. 이미 쓸 수 있는 결과가 있는데 실패로 끝내지 않는다. 호출 실패·타임아웃(`EXTERNAL_SERVICE_ERROR`)도 같다.
   - 재생성 결과에도 중복이 있으면 중복이 적은 쪽을 반환한다.
5. `GenerationResult`에 `historyDuplicates`를 추가하고 `quiz.generation` 로그에 `historyDuplicates={}`를 남긴다. 노트 본문·문제 문장은 남기지 않는다.
6. 기존 동작 유지: 시도 최대 2회, 30초 예산, 검증 실패 시 503 `QUIZ_VALIDATION_FAILED`, 응답 필드.

### Frontend

변경 없음.

### 테스트 (`QuizServiceTest`, `QuizQualityValidatorTest` 영향 없음 확인)

- 이력 중복 없음: 1회 호출로 저장.
- 첫 결과가 이력과 중복 → 재생성 1회, 중복 없는 두 번째 결과 저장.
- 두 번 모두 중복 → 실패 없이 저장, AI 호출 2회, 로그 `historyDuplicates=` 확인.
- 첫 결과 중복 + 재생성 결과 검증 실패 → 첫 결과 저장.
- 첫 결과 중복 + 재생성 시 AI 호출 실패 → 첫 결과 저장.
- 첫 결과 중복이지만 첫 호출이 30초 초과 → 재생성 없이 저장.
- 비교는 정규화 후 일치(공백·대소문자만 다른 문장도 중복).
- 이력 조회에 학생 ID·강의 ID·200개 제한이 넘어가는지 확인.
- 기존 `generateQuiz*` 테스트는 이력 조회 mock 기본값(빈 목록)으로 그대로 통과해야 한다.

### 한계

AI는 이전 문제를 모르므로 같은 노트로 다시 만들면 같은 문제가 다시 나올 수 있고, 재생성은 확률적으로만 줄인다. 효과가 부족하면 프롬프트에 최근 문제 목록(최대 N개)을 "피할 문제"로 넣는 방식을 검토한다. 이 경우 `PROMPT_VERSION`을 올리고 입력 토큰이 늘며, AGENTS.md에 따라 명시적 승인이 필요하다. 로그의 `historyDuplicates` 빈도로 판단한다.

### 검증 결과

- `backend\gradlew.bat test` 통과 (255개, 신규 7개). 새 JPQL은 `BackendApplicationTests`의 컨텍스트 기동에서 함께 검증된다.
- 로그 예: `quiz.generation status=SUCCESS ... attempts=2 unverified=0 historyDuplicates=1 ...`
- 프론트 변경이 없어 프론트 검증은 생략했다. 실서버·실제 AI 응답으로는 확인하지 않았다.

## 다음 작업 (상세 계획은 착수 시 작성)

- P2-3 일부: 기존 데이터(`UserAnswer`, `sourceBlockId`)로 유형별 정답률·출처 블록별 오답률.
- P1-4 후속: 프롬프트에 이전 문제 목록 넣기 (승인 필요, `historyDuplicates` 빈도 확인 후).
- P1-1 노트 청킹은 보류한다. `REJECTED_TOO_LONG` 로그 빈도를 보고 결정한다.
