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
- `eaf58e9` 주관식 채점 정규화(P2-6 1차): 주관식만 공백·앞뒤 문장부호 무시, 서버·`CBTPlayer` 같은 규칙
- `c65909e` 난이도별 출제 기준 프롬프트(P2-2), `PROMPT_VERSION` `2026-10-03.1`
- `4e20a3a` 주관식 정답을 짧은 단어·구로 제한하는 프롬프트 조건, `PROMPT_VERSION` `2026-10-03.2`
- `a49ec5d` 255자 초과 답안을 409 대신 400으로 안내(`@Size(max = 255)`, 입력 `maxLength`)
- 세부 내용과 수동 테스트 결과는 `docs/1003.md` 8~10번에 있다.

## 이번 작업: 풀이 기록 삭제 (2026-10-03 완료)

### 목표

학습 보관함 "풀이 이력"의 기록을 하나씩 지울 수 있게 한다. 지금은 퀴즈 세트 삭제(`DELETE /api/quiz/{quizSetId}`)만 있고, 풀이 기록은 쌓이기만 한다. 수동 테스트 중 필요성이 제기됐다.

### 현재 구조

- `QuizAttempt`(`quiz_attempts`)의 `userAnswers`는 `cascade = ALL, orphanRemoval = true`다. 기록을 지우면 답안(`user_answers`)도 함께 지워진다.
- `IncorrectNoteItem`은 `Question`만 참조하고 기록·답안은 참조하지 않는다. 오답노트 그룹 항목에 영향이 없고 FK 문제도 없다.
- 가상 세션(오답노트 다시 풀기·오늘의 복습, `quizSet == null`)도 `/attempts/my`에 나오며 같은 방식으로 지울 수 있다.
- 소유권 검증은 `QuizService.validateOwnership`(→ `CourseAccessException` 403), 없는 ID는 `ResourceNotFoundException`(404)이다. `deleteQuiz`와 같은 패턴을 쓴다.
- 화면: `QuizHistoryPanel`(학습 보관함 > 풀이 이력, `/attempts/my`), `QuizAttemptsModal`(퀴즈별 이력). 퀴즈 삭제는 `useQuizLibrary.handleDelete`(confirm → delete → 목록에서 제거, 실패 시 alert)다.

### Backend

- `QuizController`: `DELETE /api/quiz/attempts/{attemptId}` (`@Positive`) → 204.
- `QuizService.deleteAttempt(Long attemptId, Student student)` `@Transactional`
  1. `quizAttemptRepository.findById` → 없으면 404 "기록을 찾을 수 없습니다."
  2. `validateOwnership(attempt.getStudent(), student, "본인 풀이 기록만 삭제할 수 있습니다.")` → 403
  3. `quizAttemptRepository.delete(attempt)` (답안은 cascade로 함께 삭제)
- 새 쿼리·스키마 변경은 없다.

### 영향

- 오답 통계·오늘의 복습·취약 블록은 `user_answers` 집계라, 기록을 지우면 그 풀이의 정답·오답도 통계에서 빠진다. 기록 삭제의 자연스러운 의미로 보고 그대로 둔다. 확인 문구로 사용자에게 알린다.
- 오답노트 그룹에 직접 담은 문제는 남는다.
- 퀴즈 세트는 남아 다시 풀 수 있다.

### Frontend

- `QuizHistoryPanel`: 각 행에 휴지통 버튼을 둔다(`QuizListPanel`의 삭제 버튼과 같은 모양). `onDelete(e, attemptId)`를 호출한다.
- `useQuizLibrary.handleDeleteAttempt(e, attemptId)`
  1. `e.stopPropagation()` (행 클릭의 상세 보기를 막는다)
  2. `window.confirm('이 풀이 기록을 삭제할까요? 오답 통계에서도 빠집니다.')`
  3. `client.delete(`/quiz/attempts/${attemptId}`)` → `attempts`에서 제거
  4. 실패하면 서버 `message`(없으면 "풀이 기록을 삭제하지 못했습니다.")를 alert
- `QuizLibraryPage`에서 `QuizHistoryPanel`에 `onDelete`를 넘긴다.
- `QuizAttemptsModal`(퀴즈별 이력)에는 넣지 않는다. 같은 기록을 풀이 이력 탭에서 지울 수 있다. 필요하면 추가한다.

### 하지 않는 것

- 일괄·전체 삭제, 삭제 취소(soft delete). 필요해지면 추가한다.

### 문서

- `docs/api.md` 퀴즈 표에 `DELETE /quiz/attempts/{attemptId}`를 추가한다.
- 같은 표의 `POST /quiz/attempts` 요청에 남아 있는 `score`(이미 제거된 필드)를 `{ quizSetId, userAnswers[] }`로 정정한다.

### 테스트

- `QuizServiceTest`
  - 본인 기록 삭제 → `quizAttemptRepository.delete` 호출
  - 다른 학생의 기록 → `CourseAccessException`, delete 호출 없음
  - 없는 ID → `ResourceNotFoundException`
- `QuizControllerWebMvcTest`: `DELETE /api/quiz/attempts/1` → 204
- 프론트: `QuizHistoryPanel`의 삭제 버튼을 누르면 `onDelete`가 호출되고 `onViewAttempt`는 호출되지 않는다.

### 검증 결과

- `backend\gradlew.bat test` 264개(신규 4개), `npm run lint`·`build`·`test`(64개, 신규 1개) 통과.
- 실서버(`local` 프로필, 실제 DB)에서 확인했다. 테스트 노트·퀴즈는 지웠다.
  - OX 2문항을 모두 틀리게 풀이 → 오답 요약 시도 2·오답 2, 풀이 이력 1건
  - 없는 ID 삭제 → 404, 본인 기록 삭제 → 204, 삭제한 기록 상세 → 404
  - 삭제 후 오답 요약 시도 0·오답 0, 풀이 이력 0건, 퀴즈 세트는 남음(200)
- 다른 학생의 기록 삭제(403)는 단위 테스트로만 확인했다. 브라우저 화면은 확인하지 않았다.
- 확인 중 Gemini 호출이 한 번 `EXTERNAL_SERVICE_ERROR`로 실패했고, 다시 시도하자 성공했다. 이번 변경과는 관계없다.

## 다음 작업 (상세 계획은 착수 시 작성)

- P1-4 후속: 프롬프트에 이전 문제 목록 넣기 (승인 필요, `historyDuplicates` 빈도 확인 후).
- P1-1 노트 청킹은 보류한다. `REJECTED_TOO_LONG` 로그 빈도를 보고 결정한다.
