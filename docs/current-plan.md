# 블록 단위 AI 문제 범위 선택 (P1-5) 구현 계획 (2026-09-29)

`PLANS.md` §6 구현 순서 6번(P1-5)을 구현한다. 노트 전체가 아닌 사용자가 선택한 블록만으로 문제를 생성한다. `blockIds`를 생략한 요청은 기존과 똑같이 동작한다(하위 호환). 5번(P0-3 나머지, P0-4)은 이전 작업(`e88c237`)에서 완료했다.

## 범위

포함:

- `QuizRequest.blockIds` 선택 필드 추가와 서비스 검증
- 범위 안 노드만 추출하도록 `QuizAiGenerationService` 추출 로직 변경
- `QuizConfigModal`에 "노트 전체 / 블록 선택" 모드 추가

제외 (다음 작업 또는 별도 승인):

- `pdfBlock`에 blockId 부여 (P1-5 2단계, 노트 저장 형식 변경이라 별도 승인 필요)
- 즉시 저장(flush) API 추가
- 청킹 (P1-1)
- 프롬프트·schema 변경, DB 변경 없음. 기존 API 경로·성공 응답 필드 변경 없음.

## 현재 코드 기준점

- `QuizRequest`: `noteIds`, `typeCounts`(`@Min(1) @Max(20)`), `difficulty`만 있다.
- `QuizAiGenerationService.extractDataFromNode`는 `node.path("attrs").has("id")`로 블록 id를 판단한다.
  - **기존 버그:** `id: null`로 저장된 블록은 `asText()`가 문자열 `"null"`을 돌려준다. 그래서 `[[REF:n/null]]` 태그가 붙고 `allowedSources`에 `"null"`이 들어간다. 범위 판정도 같은 판단을 쓰므로 이번에 `hasNonNull("id")`로 고친다.
- `BlockId.js` 적용 대상: paragraph, heading, blockquote, codeBlock, taskList, bulletList, orderedList, image. `pdfBlock`은 대상이 아니다.
- 노트 JSON의 첫 노드(`content[0]`)는 제목 heading이다 (`useNoteAutosave.performSave`).
- 자동 저장 상태(`saveStatus`)는 `synced` / `saving` / `error` 세 가지뿐이다.
  - debounce(2초) 대기 중에도 `synced`로 보이므로, 대기 중인지 프론트에서 알 수 없다.
  - 이 상태는 `NotionEditor` → `onSaveStateChange` → `CourseDetailPage`의 `saveState`로 올라온다.
- `QuizConfigModal`은 `CourseDetailPage`에서만 쓰며 `currentNoteId`를 받는다. 노트 저장본은 `GET /api/notes/{noteId}`로 얻는다(`useCourseNotes`와 같은 호출).
- `QuizService.generateQuiz`: 노트 조회 → `validateNoteAccess` → `validateGenerationLimits` → `prepareInput` → 빈 입력 400 → AI 호출·검증(최대 2회) → 저장 → `quiz.generation` 결과 로그.

## 구현 단계

### 1. `QuizRequest.blockIds` (backend)

- `@Size(max = 500) private List<@NotBlank String> blockIds;`를 추가한다. 선택 필드이며 null을 허용한다.
- 기존 필드와 검증은 그대로 둔다.

### 2. `QuizService.generateQuiz` 검증

- `blockIds`가 null이거나 비어 있으면 기존 흐름과 같다.
- `blockIds`가 있는데 `noteIds`가 정확히 1개가 아니면, AI 호출 전에 `InvalidRequestException("블록 범위는 노트 1개에서만 선택할 수 있습니다.")`(400)을 던진다. 검사 위치는 `validateGenerationLimits` 근처다.
- 범위 추출 결과가 비어 있으면 `InvalidRequestException("선택한 블록에 문제를 생성할 내용이 없습니다.")`(400)을 던진다. 전체 모드의 기존 메시지("문제를 생성할 노트 내용이 없습니다.")는 그대로 둔다.
- 생성 결과 로그(`quiz.generation`)에 `scope=NOTE|BLOCK blockCount=…`를 덧붙인다. 기존 필드는 유지한다.

### 3. `QuizAiGenerationService.prepareInput` 범위 추출

- 시그니처를 `prepareInput(List<Note> notes, Student student, Set<String> blockScope)`로 바꾼다. `blockScope == null`이면 전체 모드다.
  - 기존 호출부와 테스트는 `null`을 넘기도록 고친다. 오버로드는 만들지 않는다.
- `extractDataFromNode`에 `boolean inScope` 인자를 추가한다.
  - 자기 id가 `blockScope`에 있거나 부모가 범위 안이면 범위 안이다. 자식에게는 이 값을 물려준다.
  - 범위 밖 노드는 텍스트, REF, 미디어를 모두 넣지 않고 자식만 계속 순회한다.
  - 리스트나 인용 블록을 선택하면 하위 블록이 모두 포함된다.
- 순회하면서 문서에 실제로 있는 blockId를 모은다. 선택한 id 중 없는 것이 있으면 `InvalidRequestException("선택한 블록을 찾을 수 없습니다. 노트가 저장된 뒤 다시 시도해 주세요.")`(400)을 던진다. 노트 JSON 파싱 실패를 400으로 처리하는 기존 방식과 같다.
- blockId 판단을 `attrs.hasNonNull("id")`로 고친다(위의 기존 버그). id가 null인 블록은 부모 id를 물려받으며 범위 선택 대상이 아니다.
- 출처 검증은 변경하지 않는다. 범위 모드에서는 `allowedSources`가 곧 선택 범위이므로, 범위 밖 출처는 기존 `QuizQualityValidator`가 null(미검증)로 처리한다.

### 4. `QuizConfigModal` 범위 모드 (frontend)

- `CourseDetailPage`가 `saveStatus={saveState.status}` prop을 넘긴다.
- "학습 범위" 영역에 "노트 전체 / 블록 선택" 토글을 둔다. 기본값은 노트 전체다.
- 블록 선택 모드:
  - 대상은 현재 노트(`currentNoteId`) 하나다. 노트 트리 대신 블록 목록을 보여준다.
  - 모드에 들어갈 때마다 `client.get(`/notes/${currentNoteId}`)`로 저장본을 다시 읽는다.
  - 저장본 최상위 노드 중 제목(`content[0]`)을 제외하고 `attrs.id`가 있는 노드만 목록에 넣는다. 각 항목에는 유형 라벨과 텍스트 미리보기(최대 60자)를 붙인다.
  - heading을 선택하면 다음에 나오는 같은 레벨 이하 heading 전까지의 블록을 함께 선택한다. 해제할 때도 같은 범위를 해제한다.
  - id가 없는 블록(`pdfBlock` 등)이 있으면 "PDF 등 일부 블록은 노트 전체 모드에서만 포함됩니다"라고 안내한다.
  - 목록 위에 "최근 입력은 자동 저장(약 2초) 후 목록에 반영됩니다"라고 안내한다.
  - `saveStatus`가 `saving`이나 `error`이면 생성 버튼을 막고 사유를 표시한다. 기존 `disabledReason` 패턴을 따른다.
  - 선택한 블록이 0개이면 생성 버튼을 막는다.
- payload:
  - 전체 모드는 기존과 완전히 같다(`blockIds` 키 없음).
  - 블록 모드는 `{ noteIds: [currentNoteId], blockIds, typeCounts, difficulty }`다.
- `SummaryStrip`은 블록 모드에서 "N개 블록"을 표시한다.
- 기존 `NoteScopeSection`처럼 같은 파일 안에 `BlockScopeSection` 컴포넌트를 둔다.
- 새 라이브러리는 추가하지 않는다. 요청은 `src/api/client.js`를 사용한다.

## 수정 대상 파일

- `backend/src/main/java/com/uninote/backend/dto/QuizRequest.java`
- `backend/src/main/java/com/uninote/backend/service/QuizService.java`
- `backend/src/main/java/com/uninote/backend/service/QuizAiGenerationService.java`
- `frontend/src/components/editor/components/QuizConfigModal.jsx`
- `frontend/src/pages/CourseDetailPage.jsx` (prop 1개 전달)
- 테스트: `QuizServiceTest`, `QuizAiGenerationServiceTest`, `QuizControllerWebMvcTest`, `QuizConfigModal.test.jsx`
- 문서: `docs/api.md`의 `/quiz/generate` 요청 본문에 선택 필드 `blockIds` 표기

## 기존 테스트 영향

- `prepareInput` 시그니처가 바뀌어 호출부를 고친다.
  - `QuizServiceTest`의 `prepareInput(any(), any())` stub은 3-인자로 바꾼다.
  - `QuizAiGenerationServiceTest`의 호출에는 `null`을 추가한다.
- `id: null` 처리가 바뀐다. 해당 기대값을 가진 기존 테스트는 없다.
- `QuizConfigModal.test.jsx`의 전체 모드 payload 테스트는 그대로 통과해야 한다(회귀 방어). 블록 모드를 위해 client mock에 `get`을 추가한다.

## 추가 테스트

Backend:

- `blockIds` 없음: 추출 결과가 기존과 같다.
- 단일 노트 + `blockIds`: 범위 밖 텍스트·미디어·REF가 제외되고, 선택한 리스트 블록의 하위 텍스트는 포함된다.
- `allowedSources`는 범위 안 블록만 담는다.
- 저장본에 없는 blockId는 400이고 AI를 호출하지 않는다.
- 범위 추출 결과가 비면 400이고 AI를 호출하지 않는다.
- 여러 노트 + `blockIds`는 400이고 AI를 호출하지 않는다.
- `id: null` 블록에는 `REF:n/null`이 붙지 않는다.
- WebMvc: `blockIds` 501개는 400 `VALIDATION_FAILED`, 빈 문자열 원소도 400 `VALIDATION_FAILED`다.

Frontend (`QuizConfigModal.test.jsx`):

- 블록 모드로 전환하면 `GET /notes/{id}`를 호출하고, 제목을 제외한 id 보유 블록만 목록에 나온다.
- heading을 선택하면 하위 범위가 함께 선택된다.
- 블록 모드 payload에만 `blockIds`가 들어간다.
- `saveStatus='saving'`이면 생성 버튼이 비활성화된다.

## 검증

```powershell
backend\gradlew.bat test
cd frontend
npm run lint
npm run build
npm run test
```

수동 확인:

1. 노트 전체 모드 생성이 기존과 같다.
2. 블록 모드에서 heading 하나를 선택해 생성하면, 문제와 출처가 그 범위 안에서만 나온다(원문 보기로 확인).
3. 입력 후 2초가 지나기 전에 블록 모드를 열면 새 블록이 아직 목록에 없다(안내 문구대로 동작).
4. 노트 2개를 고른 상태에서 블록 모드로 전환하면 현재 노트만 대상이 된다.

## 이전 작업 미확인 항목

- `quiz.generation` 결과 로그를 실제 Gemini 호출로 확인하지 않았다 (`e88c237`).
- OSIV(`spring.jpa.open-in-view` 기본값 true) 상태에서 AI 호출 동안 DB 커넥션이 반환되는지 확인하지 않았다 (09-28 작업). 설정 변경은 범위 밖이다.
- 09-28 작업의 수동 확인 4개(정상 생성 후 원문 이동, 빈 노트 alert, 출처 null 문항의 "원문 보기" 숨김, 오답노트·오늘의 복습 원문 이동)를 하지 않았다.

## 완료 기준

- `blockIds`가 없는 요청의 동작·응답·payload가 기존과 같다.
- 블록 모드에서 AI 입력과 저장된 출처는 선택 범위 안에만 있다. 범위 밖 출처는 null이다.
- 없는 블록, 빈 범위, 여러 노트 + 블록은 AI 호출 없이 400을 반환한다.
- DB 스키마, 프롬프트·schema, 기존 API 경로와 성공 응답 필드는 변경되지 않는다.
