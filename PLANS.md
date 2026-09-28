# UniNote AI 문제 생성 고도화 계획

## 1. 목표

현재의 노트 기반 AI 문제 생성 기능을 다음 단계의 학습 시스템으로 발전시킨다.

```text
현재: 노트 → AI 문제 생성 → 풀이 → 오답노트
목표: 근거 검증 문제 생성 → 개인화 복습 → 취약 개념 기반 적응형 출제
```

기존 노트 편집·자동 저장·JWT 인증·퀴즈 API·풀이·오답노트·원문 블록 이동 계약은 유지한다. 실제 코드와 문서가 충돌하면 실제 코드를 기준으로 판단한다.

## 2. 현재 구현 요약

### Backend

- `QuizController`가 `POST /api/quiz/generate`를 제공한다.
- `QuizService`가 노트 존재 여부, 소유권, 동일 강의 여부, 노트 수·문항 수 제한을 검증한다.
- `QuizAiGenerationService`가 Tiptap JSON을 텍스트·이미지·PDF 입력으로 변환한다.
- 텍스트에는 `[[REF:noteId/blockId]]` 출처 태그가 삽입된다.
- Gemini `gemini-2.5-flash`와 JSON response schema를 사용한다.
- 생성된 `QuizSet`과 `Question`을 저장한다.
- 문제별 `sourceNoteId`, `sourceBlockId`를 저장한다.
- 첨부 파일은 서명 검증 및 총 20MB 용량 제한을 적용한다.
- 서버가 답안을 직접 채점한다.

### Frontend

- `QuizConfigModal`에서 노트, 유형별 문항 수, 난이도를 선택한다.
- `POST /api/quiz/generate` 호출 후 `CBTPlayer`를 실행한다.
- 문제 풀이 결과에서 오답노트 등록이 가능하다.
- `sourceNoteId`, `sourceBlockId`를 이용해 원문 블록으로 이동한다.

## 3. 현재 핵심 문제

### P0. AI 응답의 의미적 검증 부족

JSON 파싱에 성공해도 다음을 검증하지 않는다.

- 요청 문항 수와 실제 문항 수 일치 여부
- 유형별 문항 수 일치 여부
- `sourceNoteId`가 요청 노트에 포함되는지 여부
- `sourceBlockId`가 실제 노트 블록인지 여부
- 객관식 보기 수와 정답 포함 여부
- OX 정답 형식
- 주관식 정답·해설 누락 여부
- 문제 중복 여부

현재 Gemini schema의 문제별 필수 필드는 `type`, `questionText`, `correctAnswer`뿐이다. 따라서 출처가 누락된 문제가 `null` 상태로 저장될 수 있다.

실패가 성공처럼 보이는 경로도 있다.

- AI가 문항을 0개 반환하면 저장 없이 `quizSetId = null`인 200 응답이 나가고, 프론트는 이를 정상 결과로 처리한다 (`QuizService.generateQuiz`).
- 노트 Tiptap JSON 파싱에 실패하면 `log.warn`만 남기고 해당 노트를 제외한 채 생성을 계속한다 (`QuizAiGenerationService.processNoteContent`).

출처 연결의 구조적 한계:

- `BlockId` 확장의 적용 대상에 `pdfBlock`이 없다. 최상위 PDF 블록은 blockId가 없어 REF 태그가 붙지 않는다. (리스트 항목 안의 텍스트는 내부 `paragraph`의 id로 태그된다.)
- 이미지·PDF 데이터는 프롬프트 끝에 한꺼번에 첨부되어, 어떤 블록의 미디어인지 모델이 알 수 없다.
- blockId는 `BlockId.js`의 `renderHTML`에서 랜덤 생성되어 `data-id`로 출력된다. 복사·붙여넣기로 같은 id가 중복될 수 있다. 출처 존재 검증에는 영향이 없지만, 원문 이동은 첫 번째 일치 블록으로 간다.
- 서버는 DB에 저장된 노트 내용을 기준으로 추출한다. 에디터는 debounce 자동 저장을 쓰고 즉시 저장(flush) API가 없으므로(`useNoteAutosave`), 방금 입력한 블록은 서버에 아직 없을 수 있다.

### P1. 대형 입력과 비용 제어 부족

여러 노트의 내용을 하나의 `combinedText`로 합쳐 전달한다. 노트가 커지면 토큰 초과, 비용 증가, 응답 지연, 중요 내용 누락이 발생할 수 있다.

### P1. 동기식 생성 API의 운영 한계

현재 HTTP 요청이 Gemini 응답까지 유지된다. 생성 시간이 길어지면 중복 요청, 새로고침에 따른 결과 손실, 서버 스레드 점유, 진행 상태 부재가 발생한다.

### P1. 문제 품질 지표 부족

유형별·강의별 오답 통계(`/api/incorrect-notes/statistics/types`, `/statistics/courses`), 오늘의 복습(`/review-today`), 문제별 답안 집계(`QuestionAnswerStat`)는 이미 있다. 이를 재사용하되, 문제별 정답률, 출처 블록별 취약도, 실제 난이도, 중복률, 사용자 삭제율 기반의 문제 품질 측정은 아직 없다.

### P2. 개인화 출제와 학습 목표 미지원

현재 생성 입력은 노트, 문항 유형, 문항 수, 난이도 중심이다. 사용자의 오답·취약 개념·시험 범위·학습 목표를 문제 생성에 반영하지 않는다.

## 4. 실행 우선순위

## P0 — 생성 결과 신뢰성 강화

### P0-1. `QuizQualityValidator` 추가

`QuizAiGenerationService`가 파싱한 `QuizResponse`를 `QuizService` 저장 전에 검증한다.

전제: 현재 `generateQuiz`는 `@Transactional` 안에서 Gemini를 호출한다. 재생성을 넣으면 DB 커넥션 점유 시간이 호출 횟수만큼 늘어나므로, AI 호출·검증은 트랜잭션 밖에서 수행하고 저장만 트랜잭션으로 묶는다.

검증 항목:

1. 요청 문항 수와 응답 문항 수
2. 유형별 요청 수와 응답 수
3. 문제 유형별 필수 필드
4. 객관식 보기 개수·중복·정답 포함 여부. 채점과 같은 규칙(trim·소문자)으로 일치하는 보기를 찾고, `correctAnswer`를 그 보기 원문으로 덮어쓴다. 결과 화면의 정답 표시는 `opt === q.correctAnswer` 정확 일치를 요구하기 때문이다 (`CBTPlayer.jsx`).
5. OX 정답을 `O` 또는 `X`로 제한하고 대문자로 정규화한다. 프론트는 `'O'`/`'X'`만 제출한다.
6. 주관식 정답 공백 여부
7. 빈 문제·빈 해설 처리 기준
8. 같은 세트 안의 동일 문항(정규화 후 정확 일치). 이력 대비 유사 문항 검사는 P1-4에서 다룬다.
9. 출처 노트 ID 허용 목록
10. 출처 블록 ID 실제 존재 여부
11. 컬럼 길이: `Question.correctAnswer`, `QuizSet.title`은 기본 VARCHAR(255)다. 초과하면 DB 오류가 409 CONFLICT로 응답되므로 저장 전에 검증한다.

실패 처리:

- 구조 오류·문항 수(유형별 포함) 불일치: 전체 재생성 1회
- 출처 오류: 재생성하지 않는다. `sourceNoteId`, `sourceBlockId`를 모두 null로 저장한다(= 미검증).
- 미검증 비율 상한: 미검증 문항이 전체의 절반을 넘으면 검증 실패로 보고 전체 재생성 대상에 포함한다. 기준값은 상수로 둔다.
- 요청당 AI 호출은 최대 2회(최초 1회 + 재생성 1회), 총 시간 예산은 90초로 둔다. 현재 Gemini read timeout이 60초(`RestClientConfig`)이므로 재생성 1회에 최대 60초가 더 걸린다. 따라서 첫 호출이 30초(= 90초 − 60초)를 넘었으면 재생성하지 않고 바로 실패 처리한다. 프론트 axios에는 timeout이 없어 이 예산이 곧 사용자 대기 상한이다.
- 검증 실패 지속: 문제를 저장하지 않는다(부분 저장 없음). `ExternalServiceException`(503)으로 반환하며, 오류 코드는 P0-5를 따른다. 사용자 입력 오류가 아니므로 400을 쓰지 않는다.
- 문항 0개 응답, 노트 콘텐츠 파싱 실패: 200 성공이 아닌 명시적 오류로 반환

회귀 방어: 트랜잭션 분리와 재생성 도입 시 기존 `QuizServiceTest`의 `generateQuiz*` 테스트 8개가 모두 통과해야 한다.

### P0-2. 출처 정합성 검증

AI가 반환한 출처를 그대로 저장하지 않는다.

```text
AI sourceNoteId/sourceBlockId
  ↓
요청 노트 목록과 대조
  ↓
Tiptap 콘텐츠에서 실제 blockId 확인
  ↓
검증 통과 시 Question 저장
```

허용 집합: 추출 시 실제로 `[[REF:noteId/blockId]]`를 붙인 쌍의 집합을 그대로 사용한다. 전체 모드와 블록 범위 모드(P1-5)가 같은 로직을 쓰며, 이미지·PDF에서 나온 문제도 이 집합으로 판정한다.

미검증 표현: P0에서는 새 컬럼 없이 "출처 필드 null = 미검증"으로 표현한다. 프론트는 이미 `sourceBlockId`가 없으면 "원문 보기" 버튼을 숨기고(`CBTPlayer.jsx`), 이동 시에도 null을 막는다(`CBTPlayer.handleViewSource`, `useIncorrectNotes`). 따라서 DB·API·프론트 변경이 없다. 문제는 정상 노출된다. `pdfBlock`은 현재 blockId 자체가 없으므로(§3 참고) 블록 단위 출처를 요구하지 않는다.

### P0-3. JSON schema 및 DTO 검증 강화

- 문제 유형별 필수 필드를 schema에 반영한다.
- `sourceNoteId`, `sourceBlockId`, `explanation`의 필수 여부를 입력 유형에 따라 결정한다.
- 서버 검증은 schema를 보완하는 최종 방어선으로 유지한다.
- AI가 반환한 `difficulty`는 enum으로 파싱되고, 저장에는 이미 요청값(`request.getDifficulty()`)을 쓴다. 별도 검증 대신 응답의 difficulty도 요청값으로 덮어쓴다.
- 유형당 문항 수 제한을 맞춘다. 현재 서비스(`MAX_QUESTIONS_PER_TYPE = 20`, 하한 1)와 프론트(`QuizConfigModal` 20)는 일치하고, `QuizRequest`만 `@Min(0) @Max(50)`이다. `QuizRequest`를 `@Min(1) @Max(20)`으로 바꾸고 서비스 검증은 방어선으로 유지한다.
  - 영향: 0 또는 21~50 요청의 errorCode가 `INVALID_REQUEST`에서 `VALIDATION_FAILED`로 바뀐다(둘 다 400). 프론트는 이 범위를 보내지 않는다. `QuizServiceTest`는 서비스를 직접 호출하므로 영향이 없다.

### P0-4. 생성 메타데이터 저장

향후 문제 품질 분석과 재현을 위해 다음 메타데이터를 저장한다.

- 모델명
- prompt 버전
- 생성 시각
- 원문 content hash
- 검증 상태
- 재생성 횟수
- 생성 실패 사유

기존 API 응답 필드는 유지한다. P0 단계에서는 DB 컬럼을 추가하지 않고 구조화 로그로 먼저 기록한다. 운영 DDL 위험을 P0에 끌어들이지 않기 위해서다. DB 저장은 §5 확장 시점에 스키마 변경 절차를 따라 도입한다.

### P0-5. AI 오류와 검증 실패의 오류 코드 구분

현재 `ExternalServiceException`은 모두 `EXTERNAL_SERVICE_ERROR`(503) 하나로 응답한다(`GlobalExceptionHandler`). `ExternalServiceException`에 선택적 `errorCode`를 추가하고(기본값은 기존 코드), 핸들러는 이 값을 사용한다. HTTP 상태는 모두 503으로 유지해 기존 계약과 테스트를 보존한다.

| errorCode | 상황 | 메시지 예 |
|---|---|---|
| `EXTERNAL_SERVICE_ERROR` (기존) | Gemini 호출 실패·타임아웃 | 기존 문구 유지 |
| `AI_RESPONSE_INVALID` | JSON 파싱·응답 구조 오류 | "AI 응답 형식이 올바르지 않습니다." |
| `QUIZ_VALIDATION_FAILED` | 재생성 후에도 검증 실패 | "요청한 조건에 맞는 문제를 생성하지 못했습니다. 범위나 문항 수를 조정해 주세요." |

- 기존 `QuizAiGenerationServiceTest`는 예외 타입만 확인하므로 영향이 없다.
- 프론트 `QuizConfigModal`의 고정 문구 alert("문제 생성 중 오류가 발생했습니다.")를 서버 응답의 `message` 표시로 바꾼다.

## P1 — 입력·비용·운영 안정성

### P1-1. 노트 청킹

전체 노트를 하나의 문자열로 합치지 않고 제목·헤딩·문단·블록 기준으로 의미 단위로 분할한다.

각 청크는 다음 정보를 유지한다.

```json
{
  "noteId": 10,
  "blockId": "block-42",
  "text": "페이지 교체 알고리즘은..."
}
```

처리 흐름:

```text
Tiptap 블록 추출
  ↓
청크 분할
  ↓
핵심 개념 추출
  ↓
중복 제거·중요도 정렬
  ↓
문제 생성
```

### P1-2. 입력 크기·비용 예측

- 텍스트·미디어별 크기를 호출 전에 계산한다.
- 토큰 또는 문자 수 상한을 명시한다.
- 초과 시 자동 축약 또는 사용자에게 범위 축소를 안내한다.
- 동일 원문·동일 설정 요청은 idempotency key 또는 결과 재사용을 검토한다.
- 사용자별·강의별 AI 호출 rate limit을 추가한다.

### P1-3. 비동기 생성 Job API (선택·후순위)

현재 `@EnableAsync`, 작업 큐, Job 테이블이 모두 없어 도입 규모가 크다. P0 완료 후 실제 생성 지연을 측정하고 필요할 때 착수한다.

현재 동기 API는 유지하되, 대용량 생성을 위한 별도 Job API를 추가한다.

```http
POST /api/quiz/generation-jobs
GET  /api/quiz/generation-jobs/{jobId}
```

상태:

```text
QUEUED
EXTRACTING_CONTENT
RETRIEVING_CONTEXT
GENERATING
VALIDATING
SAVING
COMPLETED
FAILED_INPUT
FAILED_AI
FAILED_VALIDATION
FAILED_STORAGE
CANCELLED
```

Frontend는 생성 진행률, 재시도, 실패 사유를 표시한다.

### P1-4. 문제 중복 제거

P0-1 8번이 같은 세트 안의 정확 일치만 다루므로, 여기서는 이력 대비 중복을 다룬다.

- 최근 생성 문제와 question text를 비교한다.
- 동일 개념·동일 정답을 반복하는 문제를 탐지한다.
- 중복 문항만 교체 생성한다.
- 시험 대비 모드에서는 단원별 최소 출제 수와 중복 금지 조건을 적용한다.

### P1-5. 블록 단위 문제 범위 선택

노트 전체가 아닌 사용자가 선택한 블록만으로 문제를 생성한다.

API (하위 호환):

- `QuizRequest`에 선택 필드 `blockIds: List<String>`를 추가한다. 이 필드가 없으면 기존과 똑같이 동작한다.
- `blockIds`는 `noteIds`가 정확히 1개일 때만 허용한다. 여러 노트면 400 `INVALID_REQUEST`를 반환한다.
- `@Size(max = 500)` 등으로 개수 상한을 둔다.

추출:

- `QuizAiGenerationService.extractDataFromNode` 순회에 "범위 안" 판정을 더한다. 자신의 id가 선택됐거나 조상이 선택된 노드만 범위 안이다.
- 범위 밖 노드는 텍스트와 미디어를 모두 넣지 않는다. 리스트나 인용 블록을 선택하면 하위 블록이 모두 포함된다.

요청 검증 (AI 호출 전):

- 선택한 blockId 중 저장된 노트 내용에 없는 것이 있으면 400 `INVALID_REQUEST`를 반환한다. 메시지는 "선택한 블록을 찾을 수 없습니다. 노트가 저장된 뒤 다시 시도해 주세요."다.
- 범위 추출 결과 텍스트와 미디어가 모두 비어 있으면 400을 반환한다.

출처 검증: P0-2의 허용 집합이 곧 선택 범위다. 범위 밖 출처는 미검증(null)으로 저장한다.

ID가 없는 블록:

- `pdfBlock`은 `BlockId` 적용 대상이 아니다. 1단계에서는 범위 선택 대상에서 제외한다. 선택된 블록 안에 들어 있는 경우만 포함되며, UI에 "PDF는 노트 전체 모드에서만 포함" 안내를 둔다.
- 2단계(선택, 별도 승인): `BlockId` 대상에 `pdfBlock`을 추가한다. 노트 저장 형식에 속성이 추가되는 변경이며, 기존 PDF는 다시 렌더링되어 저장될 때 id를 얻는다. `PdfBlock` NodeView가 `data-id`를 DOM에 출력하는지 먼저 확인해야 원문 이동이 가능하다.
- `id`가 null로 저장된 옛 블록은 선택할 수 없고 전체 모드에서만 포함된다.

프론트:

- `QuizConfigModal`에 "범위: 노트 전체 / 블록 선택"을 추가한다.
- 블록 목록은 `GET /api/notes/{noteId}` 저장본에서 id가 있는 최상위 블록으로 구성한다.
- 헤딩을 선택하면 다음 같은 레벨 헤딩 전까지의 블록 id를 함께 선택한다.
- 자동 저장이 끝나지 않은 상태(`saveStatus`)에서는 블록 선택을 막거나 저장 대기를 안내한다(§3 자동 저장 지연 참고).

## P2 — 문제 품질·개인화

### P2-1. 학습 목표 기반 생성

생성 요청에 선택적 학습 목표를 추가한다.

```json
{
  "learningObjectives": [
    "가상 메모리의 동작 원리를 설명할 수 있다",
    "페이지 교체 알고리즘의 차이를 비교할 수 있다"
  ]
}
```

각 문제에 다음 내부 메타데이터를 추가하는 것을 검토한다.

- `conceptTags`
- `cognitiveLevel`
- `learningObjectiveId`
- `sourceBlockId`

### P2-2. 난이도 기준 구체화

| 사용자 난이도 | 생성 기준 |
|---|---|
| EASY | 정의·용어 회상 |
| NORMAL | 개념 설명·비교 |
| HARD | 사례 적용·오류 분석·추론 |

내부적으로 `REMEMBER`, `UNDERSTAND`, `APPLY`, `ANALYZE` 수준을 저장하는 방식을 검토한다.

### P2-3. 취약 개념 기반 문제 생성

기존 풀이·오답 데이터를 이용해 다음 정보를 계산한다. 기존 데이터(`sourceBlockId`, `UserAnswer`, `QuestionType`)만으로 가능한 지표를 먼저 구현하고, 개념별 정답률은 P2-1의 `conceptTags` 도입 후에 구현한다.

- 지금 가능: 유형별 정답률, 재시도 정답률, 출처 블록별 오답률, 최근 오답 빈도
- `conceptTags` 필요: 개념별 정답률

예시:

```text
LRU/FIFO 혼동
최근 정답률 25%
주관식 정답률 20%
→ LRU/FIFO 비교·적용 문제를 주관식 중심으로 생성
```

### P2-4. 오답 기반 재생성 모드

프론트에 다음 생성 모드를 추가한다.

- 취약 개념 중심 문제 만들기
- 최근 틀린 문제와 유사한 문제 만들기
- 이번 주 복습용 문제 만들기
- 시험 직전 모의고사 만들기

같은 문제를 단순 반복하지 않고, 비교·사례 적용·오개념 판별 등 다른 인지 유형으로 변형한다.

### P2-5. 객관식 선택지 품질 개선

- 오답은 노트의 실제 혼동 개념에서 생성한다.
- 정답만 길거나 구체적이지 않도록 보기 길이를 균형화한다.
- 보기의 문법 형태를 통일한다.
- `항상`, `절대`, `모두 정답`과 같은 단서 남용을 제한한다.

### P2-6. 주관식 채점 개선

다음 순서로 점진적으로 개선한다.

```text
1차: 공백·대소문자·기호 정규화
2차: 등록된 동의어·허용 답안 비교
3차: 핵심 키워드 포함 여부
4차: 필요한 경우에만 LLM 보조 채점
```

모든 답안을 LLM으로 채점하지 않고 규칙 기반 채점을 우선한다.

현재 채점 규칙은 서버 `QuizService.isAnswerCorrect` 한 곳과 프론트 `CBTPlayer.jsx`의 두 곳(점수 계산, 결과 화면 판정)이 같은 trim·소문자 비교를 쓴다. 1차 정규화 변경까지는 세 곳을 함께 수정한다.

2차(동의어) 이후는 프론트가 서버 규칙을 복제할 수 없다. 이 시점에는 프론트 로컬 판정을 제거하고 서버 채점 결과(`isCorrect`)를 받아 표시하도록 일원화한다. `POST /api/quiz/attempts` 응답 확장이 필요한 API 변경이므로 프론트와 문서를 함께 갱신한다.

## P3 — 대규모 검색·운영 분석

### P3-1. 임베딩 기반 RAG (선택·후순위)

현재 MySQL만 사용하며 벡터 저장소·임베딩 파이프라인이 없다. P1-1 청킹과 입력 크기 제한으로 해결되지 않을 때만 검토한다.

대규모 노트에서는 전체 내용을 매번 전달하지 않고, 블록 단위 임베딩과 검색을 사용한다.

```text
노트 저장
  ↓
블록 정규화·임베딩
  ↓
개념·출처와 함께 저장
  ↓
문제 생성 요청
  ↓
관련 블록 검색
  ↓
검색 근거만 Gemini에 전달
  ↓
문제 생성·출처 검증
```

### P3-2. 생성 당시 원문 Snapshot

노트 수정 후에도 문제의 근거를 확인할 수 있도록 문제 생성 시점의 원문 정보를 보존한다.

```json
{
  "noteId": 10,
  "blockId": "block-42",
  "contentHash": "sha256...",
  "noteUpdatedAt": "2026-09-28T10:20:00",
  "sourceText": "페이지 폴트는..."
}
```

초기에는 `contentHash`와 생성 시각을 저장하고, 원문 전문 저장은 저장 용량과 개인정보 정책을 검토한 뒤 결정한다.

### P3-3. 문제 품질 대시보드

운영·프롬프트 개선을 위해 다음 지표를 수집한다.

| 지표 | 목표 예시 |
|---|---:|
| 생성 요청 성공률 | 98% 이상 |
| JSON 파싱 실패율 | 1% 이하 |
| 출처 누락률 | 2% 이하 |
| 잘못된 출처 연결률 | 0% 목표 |
| 요청 문항 수 일치율 | 99% 이상 |
| 중복 문제 비율 | 3% 이하 |
| 문제 평균 정답률 | 난이도별 모니터링 |
| 출처 원문 이동 성공률 | 98% 이상 |
| 동일 요청 중복 생성 | 0건 목표 |

## 5. 데이터 모델 확장 후보

기존 API 계약을 깨지 않는 것을 전제로 다음 필드를 단계적으로 검토한다.

스키마 변경 절차: 운영 설정은 `ddl-auto: validate`(`application-prod.yaml`), 로컬은 `update`이며 Flyway/Liquibase가 없다. 엔티티에 필드만 추가하면 로컬에서는 동작하지만 운영 서버는 기동에 실패한다. 컬럼을 추가할 때는 운영용 DDL 스크립트를 함께 작성하고 스키마 변경 내용을 문서화한다. (AGENTS.md가 참조하는 `docs/db구조.md`는 현재 저장소에 없다.)

### Question

- `conceptTags`
- `cognitiveLevel`
- `learningObjectiveId`
- `validationStatus`
- `sourceContentHash`
- `promptVersion`

### QuizSet

- `generationMode`
- `modelName`
- `requestedQuestionCount`
- `validatedQuestionCount`
- `regeneratedQuestionCount`
- `generationStatus`

### UserAnswer

- 풀이 시간
- 시도 횟수
- 힌트 사용 여부
- 복습 후 재정답 여부

풀이 시간은 현재 측정할 수 없다. `QuizAttempt`의 `startTime`, `endTime`이 모두 저장 시점 `now()`로 기록된다. 프론트 계측과 요청 필드 추가가 먼저 필요하다.

새 필드는 기존 응답에 무조건 노출하지 않고, 필요할 때 DTO에 선택적으로 추가한다.

## 6. 구현 순서

1. `QuizQualityValidator` 설계 및 단위 테스트 작성
2. 문제 유형별 응답 검증 구현 (정답 치환·OX 정규화·길이 검증 포함)
3. 출처 노트·블록 정합성 검증 구현
4. AI 호출을 트랜잭션 밖으로 분리하고, 검증 실패·재생성 정책(호출 최대 2회) 구현
5. 생성 메타데이터와 prompt 버전 로그 기록, 오류 코드 구분(P0-5)과 DTO 제한 통일
6. 블록 단위 문제 범위 선택(P1-5)
7. 노트 청킹 및 입력 크기 제한 구현
8. 이력 대비 중복 문제 제거 및 rate limit/idempotency 검토
9. 기존 데이터 기반 취약 지표(유형별·출처 블록별) 구현
10. 개념 태그·학습 목표·난이도 기준 추가
11. 개념별 지표와 오답·취약 개념 기반 개인화 생성 구현
12. 문제 품질 지표 및 운영 대시보드 추가
13. (선택) 생성 Job API와 진행 상태 UI
14. (선택) 임베딩 기반 RAG와 원문 Snapshot 도입

## 7. 검증 계획

### Backend

```powershell
cd backend
.\gradlew.bat test
```

필수 테스트:

- 요청 문항 수와 응답 문항 수 불일치
- 유형별 문항 수 불일치
- 출처 노트 ID 위조
- 존재하지 않는 출처 블록 ID
- 객관식 정답이 보기 목록에 없는 경우
- 객관식 정답이 보기와 대소문자·공백만 다를 때 보기 원문으로 치환
- OX 이외의 정답, 소문자 `o`/`x` 정규화
- 정답·제목 255자 초과
- 재생성 후에도 실패 시 저장 없이 503 반환, AI 호출 2회 초과 없음
- 첫 호출이 30초를 넘으면 재생성하지 않음
- 범위 밖·위조 출처는 null로 저장, 미검증 비율 초과 시 재생성
- errorCode 3종(`EXTERNAL_SERVICE_ERROR`, `AI_RESPONSE_INVALID`, `QUIZ_VALIDATION_FAILED`) 구분 (WebMvc)
- 유형당 문항 수 21 → 400 `VALIDATION_FAILED`
- `blockIds` 없음: 기존 동작과 동일
- 단일 노트 + `blockIds`: 범위 밖 텍스트·미디어 제외
- 여러 노트 + `blockIds`: 400
- 저장본에 없는 blockId, 범위 추출 결과 없음: AI 호출 없이 400

회귀 방어: 기존 `QuizServiceTest`의 `generateQuiz*` 8개, `QuizControllerWebMvcTest`의 typeCounts 검증 테스트가 계속 통과해야 한다.
- 중복 문제
- AI API 오류
- AI 응답 파싱 오류
- 미디어 소유권·용량 검증
- 정상 생성·저장·원문 이동 데이터 전달

### Frontend

```powershell
cd frontend
npm run lint
npm run build
npm run test
```

필수 검증:

- 생성 설정 payload 유지
- 생성 중 중복 제출 방지
- 생성 실패 사유 표시 (서버 `message`)
- 전체 모드 payload는 기존과 동일, 범위 모드 payload에만 `blockIds` 포함 (`QuizConfigModal.test.jsx` 확장)
- 생성 완료 후 CBTPlayer 연결
- 출처 블록 이동 및 실패 안내
- 기존 풀이·오답노트 흐름 회귀 없음

## 8. 완료 기준

- AI 응답이 형식뿐 아니라 의미적으로 검증된다.
- 요청한 문항 수·유형 수와 저장된 문항이 일치한다.
- 저장된 모든 문제는 출처가 실제 입력 노트·블록(범위 모드에서는 선택 범위)으로 검증되었거나, 출처 필드가 null(미검증)이다. 미검증 문항은 전체의 절반을 넘지 않는다. (PDF처럼 blockId가 없는 입력 포함)
- 긴 노트와 미디어 입력에 대해 비용·용량·시간 제한이 작동한다.
- 생성 실패가 조용한 성공처럼 보이지 않는다. (문항 0개 응답, 노트 파싱 실패 포함. 범위는 생성 흐름이며, 풀이 저장 실패 시에도 제출 완료로 처리되는 `CBTPlayer.handleSubmit` 동작은 별도 과제로 다룬다.)
- 풀이·오답 데이터가 다음 문제 생성에 활용된다.
- 기존 REST API 경로, 인증 흐름, 노트 저장 형식, 원문 이동 계약이 유지된다.
