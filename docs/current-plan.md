# PLANS.md 구현 현황 (2026-10-03, 코드 대조 기준)

`PLANS.md`의 각 항목을 실제 코드·커밋과 대조해 완료 여부를 정리했다. 다음 작업 선정의 기준으로 쓴다.

## 완료

- P0-1 `QuizQualityValidator` 도입, AI 호출의 트랜잭션 분리, 재생성 최대 2회·30초 예산 (`36a6dd3`)
- P0-2 출처 허용 집합 검증, 허용 집합 밖 출처는 null(미검증)로 저장
- P0-3 JSON schema 강화, `QuizRequest`의 `@Min(1) @Max(20)` 통일, 응답 difficulty를 요청값으로 덮어쓰기 (`e88c237`)
- P0-4 구조화 로그 `quiz.generation ...` (모델명·promptVersion·시도 횟수·미검증 수·실패 사유). 원문 content hash는 빠져 있다.
- P0-5 errorCode 3종(`EXTERNAL_SERVICE_ERROR`, `AI_RESPONSE_INVALID`, `QUIZ_VALIDATION_FAILED`) 구분, 프론트가 서버 `message`를 표시
- P1-5 블록 단위 범위 선택 (`394debb`). 여러 노트의 블록을 선택하도록 확장했다 (`c70b200`).

## 미구현

| 항목 | 내용 | 비고 |
|---|---|---|
| P0-4 잔여 | 원문 content hash 로그 기록 | |
| P1-1 | 노트 청킹, 핵심 개념 추출, 중요도 정렬 | |
| P1-2 잔여 | idempotency, rate limit, 초과 시 자동 축약 | 텍스트 상한은 2026-10-03 반영(아래) |
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

## 이번 작업: P1-2 입력 텍스트 크기 상한 (2026-10-03, 완료)

- `QuizService.MAX_INPUT_TEXT_CHARS = 200_000`. 추출 텍스트(REF 태그 포함)가 이를 넘으면 AI 호출 없이 400 `INVALID_REQUEST`를 반환한다.
- 메시지: "노트 내용이 너무 깁니다(N자, 최대 200,000자). 노트 수를 줄이거나 블록 범위를 선택해 주세요." 프론트 `QuizConfigModal`은 서버 `message`를 그대로 표시하므로 프론트 변경은 없다.
- 미디어는 기존 총 20MB 제한을 그대로 쓴다.
- 테스트: `QuizServiceTest.generateQuizRejectsTooLongInputTextWithoutCallingAi`. `backend\gradlew.bat test` 통과.
- 상한은 글자 수 근사치다. 토큰 단위 제한이 필요하면 Gemini countTokens로 바꾼다.

## 다음 작업

`PLANS.md` §6 7번의 나머지인 P1-1 노트 청킹이 다음 차례다. 상세 구현 계획은 착수할 때 이 문서에 작성한다.
