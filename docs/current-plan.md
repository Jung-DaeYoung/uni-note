# 오답노트 원문 블록 표시 기능 설계 (2026-09-27)

## 목표

오답노트의 **원문 보기**를 눌렀을 때 출처 노트로 이동하는 것에서 끝나지 않고, 문제 생성에 사용된 `sourceBlockId`에 해당하는 블록을 화면 중앙으로 이동시키고 일정 시간 명확하게 표시한다. 사용자가 긴 노트에서 출처를 다시 찾지 않아도 되도록 하며, 기존 노트 편집·자동 저장·블록 ID 계약은 변경하지 않는다.

## 현재 코드 상태

현재 기능의 기본 연결은 이미 구현되어 있다.

```text
Question.sourceNoteId/sourceBlockId
  → QuestionResponse
  → TodayReviewList 또는 CBTPlayer의 원문 보기
  → navigate(/course/{courseId}/note/{sourceNoteId},
             { state: { scrollToBlockId: sourceBlockId } })
  → CourseDetailPage
  → NotionEditor
  → useSourceBlockScroll
```

- `BlockId` 확장이 블록에 `data-id`를 출력한다.
- `NotionEditor`가 `useSourceBlockScroll(editor)`를 호출한다.
- 현재 훅은 `data-id` 요소를 찾아 `scrollIntoView`하고 `origin-highlight` 클래스를 3초 적용한다.
- CBT 결과 화면과 오늘의 복습 목록 모두 동일한 라우팅 state 계약을 사용한다.

따라서 이번 요구사항은 새 출처 데이터 구조를 추가하는 작업이 아니라, **기존 이동 계약을 안정적인 블록 탐색·강조 UX로 보강하는 작업**으로 정의한다.

## 권장 동작 흐름

1. 사용자가 오답 문제의 `원문 보기`를 누른다.
2. `sourceNoteId`와 `sourceBlockId`의 존재 여부를 확인한다.
3. 두 값이 모두 있으면 다음 경로로 이동한다.

   ```text
   /course/{courseId}/note/{sourceNoteId}
   state: {
     sourceBlockId: "<block-id>",
     sourceNavigationId: "<unique-request-id>"
   }
   ```

4. `CourseDetailPage`가 대상 노트를 조회하고 `NotionEditor`를 마운트한다.
5. 에디터가 실제 DOM을 렌더링할 때까지 기다린 뒤, 해당 에디터 컨테이너 내부에서 `[data-id="..."]`를 찾는다.
6. 블록을 찾으면:
   - `scrollIntoView({ behavior: 'smooth', block: 'center' })` 실행
   - `origin-highlight` 클래스를 추가
   - 짧은 안내 문구 또는 접근성용 상태(`출처 블록으로 이동했습니다`)를 표시
   - 약 3초 후 하이라이트 제거
7. 성공·실패와 관계없이 해당 navigation state를 `replace`로 소비하여 새로고침이나 다른 노트 이동 때 같은 강조가 반복되지 않게 한다.

## 구현 설계

### 1. 라우팅 state 계약 유지 및 명확화

- 확인 결과 현재 `sourceBlockId`는 라우터 state 키로는 전혀 쓰이지 않는다(백엔드 DTO 필드명으로만 존재). 실제 state 키는 `useIncorrectNotes.js`, `CBTPlayer.jsx`, `useSourceBlockScroll.js` 세 곳 모두에서 `scrollToBlockId`로 일치한다. 따라서 이 리네이밍은 이 세 파일을 함께 고쳐야 하는 실제 리팩터다.
- 기존 `scrollToBlockId`를 즉시 폐기하지 않고 하위 호환을 위해 읽을 수 있게 둔다.
- 신규 내부 이름은 `sourceBlockId`로 통일하는 것을 권장한다. 원문 보기 호출부는 `sourceBlockId`를 전달하고, 훅은 기존 `scrollToBlockId`도 fallback으로 처리한다.
- `sourceNavigationId`는 동일한 블록으로 연속 이동할 때 React Router state 변경을 구분하기 위한 선택적 식별자다.
- `sourceNoteId` 또는 `sourceBlockId`가 없으면 기존처럼 안내하고 이동하지 않는다.
- `courseId`가 없는 문제는 `/course/null/...`로 이동하지 않는다. 이 경우 원문 보기 버튼을 비활성화하거나 `출처 강의 정보를 찾을 수 없습니다`를 표시한다.

### 2. 블록 탐색 시점 개선

현재의 고정 800ms 대기는 네트워크 지연, React 렌더링, 에디터 초기화 시간에 따라 너무 짧거나 불필요하게 길 수 있다. 다음 순서로 안정화한다.

1. `editor`와 navigation state가 준비될 때 effect를 시작한다.
2. 에디터 DOM을 기준으로 탐색한다. 전역 `document.querySelector` 대신 `EditorContent`를 감싸는 ref 또는 가장 가까운 `.uninote-editor` 컨테이너를 사용해 다른 화면의 같은 `data-id`와 충돌하지 않게 한다.
3. `requestAnimationFrame`을 우선 사용하고, 대상이 아직 없으면 제한된 횟수 또는 최대 약 2초의 polling으로 재시도한다.
4. 대상 발견 즉시 스크롤·강조하고 polling을 종료한다.
5. 최대 시간 내 찾지 못하면 오류를 조용히 무시하지 말고 사용자에게 `원문 블록을 찾을 수 없습니다. 노트가 수정되었거나 삭제되었을 수 있습니다.`를 표시한 뒤 state를 소비한다.

에디터가 초기 데이터를 다시 동기화하는 현재 구조를 고려해, `editor` 생성 직후뿐 아니라 `initialData`가 적용된 뒤에도 훅이 재평가되도록 한다. 단, 동일한 navigation state에 대해 여러 번 강조하지 않도록 처리한 요청 ID를 ref로 기억한다.

### 3. 하이라이트 스타일

- 확인 결과 왼쪽 accent bar(`NotionEditor.jsx`의 `.origin-highlight::before`, 4px, `#2563eb`)는 이미 배경 페이드와 함께 적용되어 있다. 신규로 필요한 것은 `prefers-reduced-motion` 처리(현재 전혀 없음)뿐이며, 얇은 outline 추가는 선택 사항으로 둔다.
- 기존 `origin-highlight` 애니메이션(배경 페이드 + accent bar)을 유지한다.
- 라이트·다크 테마 모두 충분한 대비를 확보한다.
- 편집 중인 블록의 콘텐츠나 ProseMirror 문서 자체를 변경하지 않는다. DOM class만 적용해 자동 저장에 영향을 주지 않게 한다.
- 키보드 사용자도 위치를 인지할 수 있도록 대상 요소에 일시적으로 `data-source-focused`를 부여하거나 `tabIndex=-1`을 검토한다. 기존 입력 포커스를 불필요하게 빼앗지 않는 것을 우선한다.
- `prefers-reduced-motion: reduce` 환경에서는 smooth scroll과 긴 애니메이션을 줄인다.

### 4. 상태 소비와 cleanup

확인 결과 대상을 찾은 성공 경로에서는 `useSourceBlockScroll.js:23`이 하이라이트 3초 후 이미 `navigate(location.pathname, { replace: true, state: {} })`로 state를 정리하고 있다. 다만 다음 세 가지는 실제로 빠져 있어 이번에 고친다.

- **실패 경로 정리 누락**: 현재 정리 호출은 블록을 "찾은" 분기 안에서만 실행된다. `document.querySelector`가 대상을 못 찾으면 하이라이트도, state 정리도 전혀 일어나지 않는다 → 못 찾았을 때도 안내 후 state를 제거하도록 추가한다.
- **쿼리스트링 미보존**: `location.pathname`만 사용해 정리하므로 기존 쿼리스트링이 있었다면 사라진다 → 필요한 쿼리스트링/위치 정보를 보존하도록 고친다.
- **안쪽 타이머 미취소(실제 버그)**: effect cleanup은 바깥쪽 800ms 타이머(`timer` 변수)만 `clearTimeout`하고, 하이라이트 제거용 안쪽 3000ms 타이머는 참조가 캡처되지 않아 취소되지 않는다. 빠른 노트 전환 시 이전 노트의 타이머가 현재 노트 DOM을 잘못 강조할 수 있으므로, 안쪽 타이머도 ref로 캡처해 cleanup에서 함께 취소한다.

### 5. 호출 화면 일관성

다음 두 진입점을 동일한 helper 또는 동일한 state 생성 규칙으로 맞춘다.

- `TodayReviewList` → `useIncorrectNotes.handleViewReviewSource`
- `CBTPlayer` → 결과 리포트의 `handleViewSource`

확인 결과 `TodayReviewList.jsx` 자체는 `sourceNoteId`/`sourceBlockId`를 전혀 참조하지 않는다. 실제 이동 로직은 `useIncorrectNotes.js`의 `handleViewReviewSource`에 있고, `TodayReviewList`는 이 핸들러를 prop으로 받아 클릭 시 호출할 뿐이다. 이 구조는 변경할 필요 없이 그대로 재사용한다.

현재처럼 원문 보기 이후 CBTPlayer를 닫는 동작은 유지한다. 원문 이동 후 뒤로 가기를 누르면 오답노트 화면으로 돌아올 수 있어야 하므로 history를 replace하지 않고 일반 navigate를 유지한다.

## 예외 및 데이터 정합성

| 상황 | 동작 |
|---|---|
| `sourceNoteId` 없음 | 원문 보기 버튼 비활성화 또는 출처 없음 안내 |
| `sourceBlockId` 없음 | 블록 이동 없이 출처 노트만 이동하지 않고 안내 |
| `courseId` 없음 | 잘못된 경로를 만들지 않고 강의 출처 없음 안내 |
| 대상 노트 로딩 실패 | 기존 노트 로딩 오류 흐름 유지 |
| 대상 블록 삭제·ID 변경 | 최대 탐색 시간 후 실패 안내, state 제거 |
| 같은 블록을 연속 클릭 | 새 navigation ID로 다시 스크롤·강조 |
| 빠른 노트 전환 | 이전 요청 timer 취소, 현재 요청만 처리 |
| 다른 화면에 동일 `data-id` 존재 | 에디터 컨테이너 범위 내에서만 탐색 |
| 사용자가 강조 중 직접 스크롤 | 강조는 유지하되 강제 재스크롤을 반복하지 않음 |

블록 ID 자체를 새로 생성하거나 서버에서 재계산하지 않는다. 원문과 문제의 `sourceBlockId`가 다르면 표시할 수 없으므로, 문제 생성·노트 저장 과정에서 ID 보존이 깨지는 경우는 별도 데이터 정합성 문제로 분리해 로그와 테스트로 확인한다.

확인 결과 `sourceBlockId` 누락은 삭제된 블록 같은 희귀 케이스만이 아니다. `QuizAiGenerationService`가 Gemini에 요청하는 JSON 스키마의 `required` 목록은 `type`/`questionText`/`correctAnswer`뿐이고, `sourceNoteId`/`sourceBlockId`는 선택 필드로만 요청된다. AI가 이를 빠뜨리면 그대로 `null`로 저장되므로 위 표의 "`sourceBlockId` 없음" 케이스는 실제로 꽤 자주 마주칠 수 있다. 프론트 두 진입점(`useIncorrectNotes.js`, `CBTPlayer.jsx`)이 이미 두 필드를 null-guard하고 있는 것도 이 빈도를 방증한다. 따라서 이번 계획의 "출처 없음" 안내 UX는 예외 처리가 아니라 자주 보일 정상 경로로 간주해 설계한다.

## 검증 계획

프론트엔드 변경 시 다음을 실행한다.

```powershell
cd frontend
npm run lint
npm run build
npm run test -- --run
```

수동 검증 항목:

1. 오늘의 복습에서 원문 보기 클릭 시 정확한 노트로 이동한다.
2. CBT 결과 리포트에서 원문 보기 클릭 시 동일하게 동작한다.
3. 긴 노트에서 대상 블록이 화면 중앙 부근에 위치한다.
4. 대상 블록이 배경·accent bar·outline으로 명확히 표시된다.
5. 약 3초 후 하이라이트가 제거된다.
6. 새로고침하거나 다른 노트로 이동했을 때 이전 강조가 반복되지 않는다.
7. 존재하지 않는 블록은 무한 재시도하지 않고 안내 후 state가 제거된다.
8. 같은 `data-id`가 다른 화면에 있어도 대상 에디터의 블록만 선택된다.
9. 라이트·다크 모드와 `prefers-reduced-motion`에서 가독성이 유지된다.
10. 원문 보기 후 브라우저 뒤로 가기로 오답노트 화면에 복귀한다.

## 완료 기준

- 원문 보기 클릭 후 올바른 노트와 출처 블록으로 자동 이동한다.
- 해당 블록이 최소 3초 동안 시각적으로 명확하게 표시된다.
- 블록 탐색 실패가 무한 대기·무한 반복·조용한 성공처럼 보이지 않는다.
- CBT 결과와 오늘의 복습 목록의 동작이 일관된다.
- 기존 `sourceNoteId/sourceBlockId`, 노트 콘텐츠, 자동 저장, API 응답 계약을 변경하지 않는다.
