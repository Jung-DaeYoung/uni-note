# 🎓 UniNote 코드 과외 — 4강: Tiptap 에디터 편집, 자동 저장 (Autosave) & 로컬 복구

---

## 1. 이 기능이 무엇인가?

노션(Notion)처럼 학생이 노트를 작성할 때 **별도의 "저장" 버튼을 누르지 않아도 타이핑을 멈추면 2초 뒤 서버에 자동으로 저장**되고, 만약 브라우저가 갑자기 꺼지거나 인터넷이 끊겨도 **브라우저 로컬 저장소(localStorage)에서 직전 작성 내용을 완벽하게 살려내는(복구) 기능**입니다.

---

## 2. 왜 필요한가?

대학 강의는 교수님의 설명이 매우 빠릅니다. 학생이 필기할 때마다 일일이 상단의 '저장' 버튼을 누르게 만든다면 필기의 흐름이 끊기고, 자칫 저장을 깜빡한 채 탭을 닫거나 배터리가 방전되면 소중한 1시간 분량의 필기가 한순간에 날아갑니다.  
따라서 **실시간 자동 저장(Autosave)**과 예기치 못한 사고에 대비한 **로컬 임시 백업 & 복구 메커니즘**은 노션 스타일 에디터의 필수적인 핵심 기술입니다.

---

## 3. 전체 동작 흐름

```
1. 사용자가 특정 노트를 열람 (/course/1/note/10)
  ↓
2. useNoteAutosave의 getInitialContent() 실행:
   - localStorage의 임시 백업본 타임스탬프와 서버 DB의 updatedAt 비교
   - 더 최신 데이터(로컬 백업 vs 서버 데이터)를 에디터 초기 내용으로 선택 및 복구!
  ↓
3. 사용자가 키보드로 필기 입력 (타이핑)
  ↓
4. Tiptap 에디터의 onUpdate 이벤트 발생
  ↓
5. useNoteAutosave의 2단계 디바운스 동작:
   - [즉각 백업]: 300ms 디바운스로 localStorage에 임시 저장 (브라우저 급종료 대비)
   - [서버 저장]: 2000ms(2초) 디바운스 타이머 가동 (네트워크 낭비 방지)
  ↓
6. 사용자가 2초간 입력을 멈춤 → performSave() 실행
  ↓
7. 이전 저장 내용(lastSavedJson.current)과 비교하여 변경 사항이 있을 때만:
   - 상단 헤더의 상태를 "Saving..." (파란 펄스)으로 변경
   - 문서 첫 블록(H1)에서 제목 추출, 200자 미리보기 텍스트 추출
   - client.put('/notes/10', ...) 호출 (AbortController 시그널 부착)
  ↓
8. NoteController → NoteService.saveNote() 수신:
   - 본인 소유 노트인지 인가(validateOwnership) 검증
   - DB notes 테이블 업데이트 (content, title, previewText, searchContent)
  ↓
9. 저장 성공 시:
   - 헤더 상태를 "Synced" (초록 불)로 변경
   - 사이드바 목차의 노트 제목 동기화 (onSaved 콜백)
  ↓
10. 네트워크 단절 등 저장 실패 시:
    - 헤더 상태를 "Error" (빨간 불)로 바꾸고 "Retry" 버튼 노출 (클릭 시 즉시 재시도)
```

---

## 4. 실제 코드 위치

**Frontend:**
- `frontend/src/components/editor/NotionEditor.jsx` — Tiptap 에디터 설정, 확장 플러그인 연결, 키보드 분기 제어
- `frontend/src/components/editor/hooks/useNoteAutosave.js` — 2초 디바운스, 로컬스토리지 백업/복구, AbortController 요청 취소, 저장 상태 머신
- `frontend/src/pages/CourseDetailPage.jsx` — 상단 헤더에 `Synced / Saving... / Error (Retry)` 배지 및 브레드크럼 렌더링
- `frontend/src/api/client.js` — Axios 통신

**Backend:**
- `backend/.../controller/NoteController.java` — `PUT /api/notes/{noteId}` 엔드포인트
- `backend/.../service/NoteService.java` — `saveNote()` (노트 소유권 검증 및 내용 수정)
- `backend/.../dto/NoteRequest.java` — 본문(최대 50만 자), 제목, 미리보기, 검색 텍스트 검증 DTO
- `backend/.../domain/Note.java` — `notes` 엔티티

**Database:**
- `notes` 테이블:
  - `content` (`LONGTEXT`): Tiptap 블록 전체를 직렬화한 순수 JSON 문자열
  - `title` (`VARCHAR(200)`): 첫 번째 H1 태그에서 자동 추출된 제목
  - `preview_text` (`VARCHAR(1000)`): 대시보드 카드 미리보기용 텍스트
  - `search_content` (`LONGTEXT`): 전문 검색용 순수 평문 텍스트
  - `updated_at` (`DATETIME`): 최근 수정 일시 (로컬 스토리지와 최신성 비교에 사용)

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. 초기 콘텐츠 결정 및 로컬 스토리지 데이터 복구

노트가 열릴 때 무조건 서버 데이터만 보여주지 않고, 로컬 스토리지에 남아 있는 임시 백업본과 타임스탬프를 비교합니다.

`useNoteAutosave.js`:

```javascript
const getInitialContent = useCallback(() => {
  const parsedServerData = safeParseJson(initialData?.content);
  const serverData = isValidTiptapDoc(parsedServerData) ? parsedServerData : null;

  // 브라우저 로컬 스토리지에 저장되어 있던 임시 데이터 조회
  const parsedLocalEntry = safeParseJson(localStorage.getItem(`note-temp-${noteId}`));
  const localData = isValidLocalEntry(parsedLocalEntry) ? parsedLocalEntry : null;

  // 로컬 데이터가 존재하고, 로컬 저장 시점이 서버 저장 시점(updatedAt)보다 더 최신이라면?
  if (localData && (!serverData || localData.timestamp > (initialData?.updatedAt || 0))) {
    return localData.content; // 네트워크 오류 등으로 서버에 못 올라간 최신 작성 내용 복구!
  }

  if (serverData) return serverData;

  // 서버 데이터도 없으면 H1 제목만 있는 기본 빈 문서 생성
  const title = initialData?.title || '';
  return {
    type: 'doc',
    content: [{
      type: 'heading',
      attrs: { level: 1 },
      content: title ? [{ type: 'text', text: title }] : [],
    }],
  };
}, [noteId, initialData]);
```

> 💬 **쉽게 말하면**: "어제 도서관에서 글 쓰다가 노트북 배터리가 꺼졌나? 서버 DB 시간보다 내 브라우저에 임시 저장된 시간이 더 최신이면, 날아갈 뻔했던 임시 저장 글을 바로 불러와서 살려주자!"라는 안전장치입니다.

---

### 🔵 STEP 2. 키 입력 시 2단계 디바운스 분리 (300ms vs 2000ms)

`useNoteAutosave.js`:

```javascript
// 1. 로컬 스토리지 임시 저장은 가볍게 300ms 디바운스
const debouncedSaveToLocalStorage = useMemo(
  () => debounce(saveDraftToLocalStorage, 300),
  [saveDraftToLocalStorage]
);

// 2. 서버 HTTP 저장은 부담이 크므로 타이핑을 완전히 멈춘 뒤 2000ms(2초) 디바운스
const debouncedSaveToServer = useMemo(
  () => debounce(performSave, 2000),
  [performSave]
);

const handleEditorUpdate = useCallback((editor) => {
  const json = editor.getJSON();
  debouncedSaveToLocalStorage(noteId, json); // 로컬 백업
  if (!isInitialMount.current) {
    debouncedSaveToServer(editor, noteId);   // 서버 자동 저장 타이머 재시작
  }
}, [noteId, debouncedSaveToLocalStorage, debouncedSaveToServer]);
```

> **디바운스(Debounce)가 뭔가요?**  
> 엘리베이터 문이 닫히려고 할 때 사람이 타면 타이머가 다시 0초부터 리셋되는 것과 같습니다. 키보드를 한 글자씩 칠 때마다 서버로 요청을 보내면 서버가 폭발하므로, **"마지막 키를 누르고 2초 동안 아무 입력이 없을 때 딱 1번만 서버로 보낸다"**는 기술입니다.

> 💬 **쉽게 말하면**: 브라우저 로컬 저장소에는 0.3초마다 잽싸게 메모해두고, 무거운 서버 통신은 사용자가 생각을 정리하느라 타자를 2초간 멈췄을 때 한 번에 보냅니다.

---

### 🔵 STEP 3. 실제 서버 저장 (`performSave`) 및 메타데이터 자동 가공

`useNoteAutosave.js`:

```javascript
const performSave = useCallback(async (editor, id) => {
  const jsonContent = editor.getJSON();
  
  // 1. 첫 번째 H1 노드를 제목으로 자동 추출
  const titleNode = jsonContent.content[0];
  const title = titleNode?.content?.[0]?.text || '제목 없음';

  // 2. 대시보드 미리보기용 텍스트와 검색용 평문 추출
  const plainText = editor.getText();
  const previewText = plainText.substring(title.length, title.length + 200).trim();

  // 3. 내용이 직전 저장과 완전히 동일하면 불필요한 네트워크 통신 스킵
  if (JSON.stringify(jsonContent) === JSON.stringify(lastSavedJson.current)) return;

  const controller = new AbortController();
  activeRequestControllerRef.current = controller;

  setSaveStatus('saving'); // UI 상태: "Saving..."
  try {
    await client.put(`/notes/${id}`, {
      title: title,
      content: JSON.stringify(jsonContent),
      previewText: previewText,
      searchContent: plainText,
    }, { signal: controller.signal });

    lastSavedJson.current = jsonContent;
    setSaveStatus('synced'); // UI 상태: "Synced"
    if (onSaved) onSaved();  // 사이드바 제목 갱신
  } catch (error) {
    if (axios.isCancel(error)) return; // 빠른 페이지 전환으로 취소된 요청은 에러가 아님!
    console.error('서버 저장 실패:', error);
    setSaveStatus('error');  // UI 상태: "Error"
  }
}, [onSaved]);
```

> 💬 **쉽게 말하면**: 본문 맨 윗줄을 읽어서 "아, 이게 노트 제목이구나" 하고 알아서 제목을 뽑아내고, 검색용 텍스트도 만들어서 서버에 `PUT` 요청을 날립니다. 직전 저장 내용과 똑같다면 서버를 귀찮게 하지 않습니다.

---

### 🔵 STEP 4. 빠른 노트 전환 시 경쟁 상태(Race Condition) 방지

사용자가 1번 노트를 쓰다가 디바운스가 끝나기 전에 2번 노트를 클릭하면 어떤 일이 일어날까요?  
잘못하면 1번 노트를 저장하려던 비동기 요청이 늦게 도착하여 화면 상태를 꼬이게 만들 수 있습니다.

`useNoteAutosave.js`:

```javascript
// NotionEditor 언마운트 또는 노트 변경 시 호출
const cancelPendingSave = useCallback(() => {
  debouncedSaveToServer.cancel();       // 대기 중인 2초 타이머 취소
  debouncedSaveToLocalStorage.cancel(); // 대기 중인 로컬 백업 취소
  activeRequestControllerRef.current?.abort(); // 이미 서버로 날아간 HTTP 통신도 즉시 취소!
}, [debouncedSaveToServer, debouncedSaveToLocalStorage]);
```

`NotionEditor.jsx`:

```jsx
useEffect(() => {
  if (!editor) return;
  syncEditor(editor);
  return () => cancelPendingSave(); // 컴포넌트가 사라지거나 noteId가 바뀔 때 뒷정리
}, [noteId, editor, initialData, syncEditor, cancelPendingSave]);
```

> 💬 **쉽게 말하면**: 다른 노트로 방을 옮길 때, 이전 방에 걸어두었던 타이머와 아직 날아가고 있는 네트워크 요청을 `AbortController`로 가차 없이 끊어버려 다른 노트에 영향을 주지 못하게 막습니다.

---

### 🔵 STEP 5. 백엔드 `NoteController` & `NoteService`의 안전한 저장

백엔드는 클라이언트가 보낸 데이터를 무조건 믿지 않고, 글자 수 제한과 소유권을 철저히 검사합니다.

`NoteRequest.java`:

```java
@Data
public class NoteRequest {
    @NotBlank
    @Size(max = 200)
    private String title;

    @NotBlank
    @Size(max = 500_000) // Tiptap JSON 크기를 최대 50만 자로 제한 (DDoS 및 DB 폭주 방지)
    private String content;

    @Size(max = 1000)
    private String previewText;

    @Size(max = 500_000)
    private String searchContent;
}
```

`NoteService.java`:

```java
@Transactional
public NoteResponse saveNote(Long noteId, String studentNum, NoteRequest request) {
    Note note = noteRepository.findById(noteId)
            .orElseThrow(() -> new ResourceNotFoundException("노트를 찾을 수 없습니다."));

    // 보안 검증: 현재 로그인한 학생이 작성한 본인 노트가 맞는가?
    validateOwnership(note, studentNum);

    note.setTitle(request.getTitle());
    note.setContent(request.getContent());
    note.setPreviewText(request.getPreviewText());
    note.setSearchContent(request.getSearchContent());
    
    Note savedNote = noteRepository.save(note);
    return convertToResponse(savedNote);
}
```

> 💬 **쉽게 말하면**: "다른 사람의 노트 ID를 몰래 보내서 남의 노트를 덮어쓰려는 해킹 시도"를 `validateOwnership`으로 완벽히 차단하고, 50만 자가 넘는 비정상적인 대용량 공격도 DTO 어노테이션으로 쳐냅니다.

---

### 🔵 STEP 6. 헤더의 상태 머신 렌더링 및 수동 재시도 (Retry)

`CourseDetailPage.jsx`:

```jsx
<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
  {/* 상태별 동그라미 인디케이터 색상 */}
  <div className={`w-1.5 h-1.5 rounded-full ${
    saveState.status === 'saving' ? 'bg-blue-500 animate-pulse' : 
    saveState.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'
  }`} />
  
  {/* 상태별 텍스트 */}
  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
    {saveState.status === 'saving' ? 'Saving...' : saveState.status === 'error' ? 'Error' : 'Synced'}
  </span>

  {/* 서버 저장 실패 시 나타나는 재시도 버튼 */}
  {saveState.status === 'error' && (
    <button
      onClick={saveState.retry}
      className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider underline hover:text-red-700 dark:hover:text-red-300"
    >
      Retry
    </button>
  )}
</div>
```

> 💬 **쉽게 말하면**: 와이파이가 끊겨서 저장이 실패하면 헤더에 빨간 불이 켜지면서 `Error`와 함께 `Retry` 버튼이 뜹니다. 와이파이가 다시 연결되었을 때 사용자가 `Retry`를 누르면 방금 쓴 내용을 즉시 다시 저장합니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
[사용자 키 입력: "오늘의 컴퓨터 알고리즘..."]
       ↓
[Tiptap 에디터 onUpdate]
       ├── (300ms Debounce) ───→ [브라우저 localStorage] ("note-temp-10" 키에 JSON + 타임스탬프 기록)
       │
       └── (2000ms Debounce) ──→ [useNoteAutosave: performSave()]
                                       ↓ 변경사항 감지 (lastSavedJson과 diff)
                                 [Axios: PUT /api/notes/10]
                                 Body: { title, content: "{...}", previewText, searchContent }
                                       ↓ (헤더: Bearer JWT 토큰)
                                 [Spring NoteController.saveNote()]
                                       ↓
                                 [NoteService.saveNote()]
                                       ├── validateOwnership(note, studentNum) → 본인 확인
                                       └── noteRepository.save(note)
                                       ↓
                                 [MySQL DB]
                                 UPDATE notes SET content = '...', title = '...', updated_at = NOW() WHERE note_id = 10;
                                       ↓ 200 OK 응답
                                 [CourseDetailPage UI]
                                 "Saving..." (Blue Pulse) ───→ "Synced" (Green)
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 '저장' 버튼 대신 2초 디바운스 자동 저장인가?**
   - 사용자 경험(UX) 극대화: 노션이나 구글 닥스에 익숙한 요즘 사용자들은 저장 버튼을 누르는 행위 자체를 번거로워합니다.
   - 2000ms(2초)는 타이핑 중에는 네트워크 요청을 완전히 억제하면서도, 문장이 끝나고 잠시 숨을 고르는 틈에 저장을 완료하기에 가장 최적화된 시간입니다.

2. **왜 로컬 스토리지(300ms)와 서버 저장(2000ms)을 이원화했는가?**
   - 2초는 안전하지만, 그 2초 사이에 노트북 배터리가 꺼지거나 탭을 실수로 닫아버릴 위험이 있습니다.
   - 따라서 네트워크를 타지 않는 초경량 브라우저 로컬 저장소에는 0.3초(300ms) 주기로 빠르게 임시 스냅샷을 찍어두고, 서버 저장은 2초 주기로 묵직하게 처리하여 **데이터 유실 0%**를 달성했습니다.

3. **왜 제목(`title`)을 별도 `<input>`으로 분리하지 않고 에디터 첫 번째 H1에서 추출하는가?**
   - 노션의 본질적인 UI 철학은 "문서 전체가 하나의 캔버스"라는 점입니다.
   - 상단에 어색한 네모난 제목 텍스트박스를 두는 대신, 에디터의 첫 줄을 무조건 Heading 1로 강제(`CustomDocument: 'heading block*'`)하고, 첫 줄의 텍스트가 수정되면 자동으로 문서의 타이틀이자 사이드바의 이름이 되도록 연결했습니다.

4. **왜 `AbortController`로 이전 요청을 취소(Abort)하는가?**
   - 사용자가 노트를 빠르게 `A노트` → `B노트`로 넘겨볼 때, 네트워크 지연으로 인해 늦게 끝난 A노트의 저장 응답이 B노트를 보고 있는 화면의 상태(`saveStatus`)를 오염시키는 **경쟁 상태(Race Condition)**를 막기 위해서입니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| 디바운스(Debounce) vs 스로틀(Throttle) | **디바운스**는 "마지막 이벤트가 끝나고 N초 뒤 딱 1번 실행"하는 방식(자동 저장에 적합)이고, **스로틀**은 "이벤트가 계속 터져도 N초마다 무조건 1번씩 주기적 실행"하는 방식(스크롤 이벤트에 적합)입니다. |
| `lastSavedJson`을 왜 `useState`가 아닌 `useRef`로 만드나요? | 저장 완료 후 이전 저장 내용을 기억해둘 때, `useState`를 쓰면 컴포넌트가 불필요하게 리렌더링됩니다. `useRef`는 화면을 다시 그리지 않고 값만 몰래 보관하기에 최적입니다. |
| `editor.getHTML()` vs `editor.getJSON()` | HTML은 태그 텍스트라 블록 ID, 커스텀 컴포넌트 속성(attrs), 문항 출처 추적 메타데이터를 정밀하게 보존하기 어렵습니다. Tiptap은 **트리 구조의 JSON** 객체로 저장하는 것이 데이터 정합성에 훨씬 유리합니다. |
| `safeParseJson`은 왜 필요한가요? | 로컬 스토리지나 DB에 저장된 JSON이 예기치 못한 원인으로 깨져있을 때 `JSON.parse`가 터지면 React 앱 전체가 하얀 화면(Whiteout)으로 사망합니다. `try-catch`로 감싸 `null`을 반환하게 해야 안전합니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"웹 에디터에서 자동 저장(Autosave)을 구현할 때 발생할 수 있는 문제점들과, UniNote에서는 이를 어떻게 해결했는지 설명해 보세요."**

✅ 이렇게 설명할 수 있습니다:
> "자동 저장을 순진하게 구현하면 두 가지 큰 문제가 발생합니다. 첫째는 키 입력마다 API를 쏴서 발생하는 **서버 과부하**이고, 둘째는 탭 강제 종료나 페이지 빠른 전환 시 발생하는 **데이터 유실 및 레이스 컨디션(Race Condition)**입니다.  
> UniNote에서는 첫째, **Lodash 디바운스(2000ms)**를 적용하고 직전 저장 JSON과의 동등성 비교를 거쳐 실제 내용 변경이 있을 때만 단일 `PUT` 요청을 보내도록 최적화했습니다.  
> 둘째, 네트워크 요청 전 300ms 디바운스로 **localStorage에 실시간 임시 백업**을 수행하고, 진입 시 DB의 `updatedAt`과 로컬 백업 타임스탬프를 비교해 더 최신 내용을 자동 복구하도록 설계했습니다.  
> 셋째, 사용자가 다른 노트로 빠르게 이동할 때 `AbortController`를 통해 진행 중인 HTTP 요청과 타이머를 즉시 취소하여 늦은 응답이 현재 화면의 저장 상태 머신을 오염시키는 경쟁 상태를 원천 차단했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**  
UniNote의 에디터에서 사용자가 타이핑을 멈추고 서버에 실제 저장이 요청되기까지 대기하는 디바운스 시간은 몇 초인가요?

**Q2. (흐름 문제)**  
갑작스러운 브라우저 강제 종료 후 사용자가 다시 노트를 열었을 때, `getInitialContent()`가 서버 데이터 대신 로컬 스토리지의 임시 데이터를 화면에 복구하는 판정 기준(조건문)은 무엇인가요?

**Q3. (코드 이해)**  
`useNoteAutosave.js`의 `performSave` 함수 내부에서 `if (JSON.stringify(jsonContent) === JSON.stringify(lastSavedJson.current)) return;` 코드가 존재하는 이유는 무엇인가요?

**Q4. (설계 이해)**  
`CourseDetailPage.jsx`에서 `saveState.status === 'error'`일 때 단순 경고창만 띄우지 않고 `Retry` 버튼을 제공하는 이유는 무엇인가요?

**Q5. (면접형)**  
사용자가 1번 노트를 작성하던 도중 2번 노트로 즉시 이동할 때, `useNoteAutosave`에서 `activeRequestControllerRef.current?.abort()`와 `axios.isCancel(error)` 처리가 누락되면 어떤 버그(경쟁 상태)가 발생할 수 있는지 설명해 보세요.
