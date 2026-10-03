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
| P2-3 잔여 | 재시도 정답률, 개념별 정답률 | 출처 블록별 취약도는 이번 작업에서 완료. 개념별은 `conceptTags`(P2-1) 필요 |
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
- `3bcb74b` 이력 대비 중복 문제 재생성(P1-4): 같은 학생·같은 강의 최근 200문제와 정규화 후 정확 일치, 1회 재생성, 남으면 저장 후 `historyDuplicates` 로그

## 이번 작업: 출처 블록별 취약도와 "취약 블록 선택" (P2-3 일부 + P2-4 일부, 2026-10-03 완료)

### 목표

학생의 풀이 기록에서 자주 틀리는 출처 블록을 찾고, AI 문제 생성 모달에서 그 블록만 범위로 골라 문제를 만들 수 있게 한다. 생성 API·프롬프트는 바꾸지 않고 기존 블록 범위 선택(P1-5)을 재사용한다.

이미 있는 지표(유형별 `/statistics/types`, 강의별 `/statistics/courses`, 복습 우선순위 `/review-today`)는 그대로 둔다. 재시도 정답률은 쓰는 화면이 없어 하지 않는다.

### Backend

1. `GET /api/quiz/incorrect/statistics/blocks` 추가 (`IncorrectNoteController`). 응답 `SourceBlockStatResponse[]`:
   `noteId`, `blockId`, `attemptCount`, `correctCount`, `incorrectCount`, `accuracyRate`, `reviewPriority`
2. `IncorrectNoteService.getBlockStatistics`: 기존 `buildQuestionReviewStats` 결과를 문제의 (`sourceNoteId`, `sourceBlockId`)로 묶는다. 새 쿼리·스키마 변경 없음.
   - 출처가 null인 문제는 제외한다.
   - 블록의 최근 오답 여부: 블록 안 문제들의 마지막 오답 시각 최댓값 = 마지막 풀이 시각 최댓값.
   - 취약도는 기존 `classifyPriority`(정답률 50% 미만, 오답 2회 이상, 최근 오답 중 하나면 HIGH)를 그대로 쓴다.
   - 정렬: 우선순위(HIGH 먼저) → 정답률 오름차순.
3. 권한: 본인 풀이 기록만 집계하므로 추가 검증은 필요 없다. 다른 강의·삭제된 노트의 블록이 섞일 수 있으며 프론트에서 걸러낸다.

### Frontend (`QuizConfigModal`)

- 학습 범위 영역에 "취약 블록 선택" 버튼을 둔다.
- 누르면 `/quiz/incorrect/statistics/blocks`를 읽어 `reviewPriority === 'HIGH'`이고 현재 노트 트리에 있는 노트의 블록만 고른다.
- 기존 선택을 이 블록들로 바꾼다: `selectedIds` 비우기, `blockSelections` 설정, 해당 노트의 블록 패널 열기, `loadBlocks` 호출.
  - `loadBlocks`는 이미 저장본에 없는 블록을 선택에서 빼므로, 노트 수정으로 사라진 블록이 서버 400으로 이어지지 않는다.
- 취약 블록이 없거나 조회에 실패하면 alert로 안내한다(서버 `message` 우선).
- 생성 payload는 기존 블록 범위 모드와 같다.

### 테스트

- Backend (`IncorrectNoteServiceTest`): 블록 단위 합산, 출처 null 제외, 우선순위 분류(HIGH/LOW), 정렬.
- Frontend (`QuizConfigModal.test.jsx`): 버튼 클릭 시 HIGH이면서 트리에 있는 노트의 블록만 payload `blockSelections`에 담김, 저장본에 없는 블록 제외, 취약 블록 없음 안내.

### 문서

- `docs/api.md` 오답노트 표에 엔드포인트 1행 추가.

### 검증 결과

- `backend\gradlew.bat test` 통과 (257개, 신규 2개).
- `npm run lint`, `npm run build`, `npm run test`(62개, 신규 2개) 통과.
- 실서버·브라우저에서는 확인하지 않았다.

## 다음 작업 (상세 계획은 착수 시 작성)

- P1-4 후속: 프롬프트에 이전 문제 목록 넣기 (승인 필요, `historyDuplicates` 빈도 확인 후).
- P1-1 노트 청킹은 보류한다. `REJECTED_TOO_LONG` 로그 빈도를 보고 결정한다.
