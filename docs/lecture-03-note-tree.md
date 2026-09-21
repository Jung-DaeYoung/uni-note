# 🎓 UniNote 코드 과외 — 3강: 계층형 노트 트리 (Note Tree)와 노트 생성/조회

---

## 1. 이 기능이 무엇인가?

노션(Notion)처럼 **강의별로 노트를 폴더처럼 무한히 하위(자식) 노트로 만들고, 사이드바에서 계층 구조(Tree)로 펼쳐보며 클릭해서 이동하는 기능**입니다.

---

## 2. 왜 필요한가?

대학 강의는 1주차~16주차, 대단원-중단원-소단원처럼 구조화되어 있습니다.
만약 노트가 단순히 평면적인 목록(List)으로만 나열된다면 학기 말이 되었을 때 수십 개의 노트가 뒤섞여 원하는 내용을 찾기 불가능해집니다.
따라서 **부모-자식 관계의 계층형 트리** 구조가 필수적입니다.

---

## 3. 전체 동작 흐름

```
[강의 페이지 진입 (/course/1)]
  ↓
1. useCourseNotes 훅 실행: GET /api/courses/1/notes/tree 요청
  ↓
2. NoteController → NoteService.getNoteTree(courseId, studentNum)
  ↓
3. NoteService 검증:
   - 학생이 이 강의를 진짜 수강 중인가? (validateEnrollment)
  ↓
4. NoteRepository:
   - 해당 강의 + 해당 학생의 모든 노트를 DB에서 단 1번의 쿼리로 일괄 조회!
  ↓
5. NoteService 메모리 트리 조립:
   - parent_note_id가 없는 노트를 Root로 설정
   - Map<Long, List<Note>>를 사용해 자식 노드들을 재귀적으로 조립
  ↓
6. Tree JSON 응답 반환 → 프론트엔드 사이드바에 트리 렌더링
  ↓
7. 만약 해당 강의에 노트가 하나도 없다면?
   - useCourseNotes가 자동으로 POST /api/courses/1/notes 호출해 빈 루트 노트 자동 생성!
  ↓
8. 노트 클릭 시 (/course/1/note/10):
   - GET /api/notes/10 호출 → 본문(Tiptap JSON) 및 상단 브레드크럼(경로) 조회
```

---

## 4. 실제 코드 위치

**Backend:**
- `backend/.../domain/Note.java` — 자기참조(Self-referencing) 엔티티 (`parentNote`, `childNotes`)
- `backend/.../controller/NoteController.java` — 노트 트리, 생성, 단건 조회, 삭제 엔드포인트
- `backend/.../service/NoteService.java` — 수강 검증, 소유권 검증, 메모리 트리 변환 알고리즘, 초기 Tiptap JSON 생성
- `backend/.../repository/NoteRepository.java` — `findByCourseAndStudentOrderByCreatedAtAsc`

**Frontend:**
- `frontend/src/hooks/useCourseNotes.js` — 트리 fetch, 첫 진입 시 자동 생성/이동, 단건 노트 fetch 관리
- `frontend/src/context/NoteTreeContext.jsx` — 트리 구조 및 페이지 링크를 위한 타이틀 검색 유틸 제공
- `frontend/src/components/course/NoteTreeItem.jsx` — 사이드바에서 재귀적으로 자식 노트를 렌더링하는 UI 컴포넌트

**Database:**
- `notes` 테이블:
  - `note_id` (PK)
  - `course_id` (FK → courses)
  - `stud_id` (FK → students)
  - `parent_note_id` (FK → notes.note_id, Nullable! 부모가 없으면 최상위 루트 노트)
  - `title`, `content` (LONGTEXT, Tiptap JSON 원본)

---

## 5. 코드가 실제로 어떻게 실행되는가?

### 🔵 STEP 1. DB 모델링: "내가 나를 참조한다" (자기참조 관계)

`Note.java`:

```java
@Entity
@Table(name = "notes")
public class Note {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long noteId;

    // 부모 노트 (나를 포함하고 있는 상위 노트)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_note_id")
    private Note parentNote;

    // 자식 노트들 (내 밑에 딸려 있는 하위 노트들)
    @OneToMany(mappedBy = "parentNote", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Note> childNotes = new ArrayList<>();
    ...
}
```

> 💬 **쉽게 말하면**: 노트 테이블 하나로 폴더와 파일을 다 해결합니다. `parent_note_id`가 비어있으면 1단계 대단원 노트이고, `parent_note_id`가 다른 노트를 가리키면 그 노트 밑으로 쏙 들어가는 자식 노트가 됩니다.  
> 특히 `orphanRemoval = true` 덕분에 **부모 노트를 삭제하면 그 밑에 있던 자식/손자 노트들도 DB에서 한꺼번에 자동 삭제(연쇄 삭제)**됩니다.

---

### 🔵 STEP 2. N+1 문제를 방지하는 기막힌 트리 조회 알고리즘

`NoteService.java`의 `getNoteTree`:

초보 개발자가 가장 많이 하는 실수는 "루트 노트를 찾고, 자식을 가져오고, 또 그 자식의 자식을 DB에서 계속 조회"해서 쿼리가 수십 번 나가는 것(N+1 문제)입니다. UniNote는 이렇게 해결했습니다:

```java
// 1. 단 1번의 쿼리로 이 학생의 이 강의 노트 '전부'를 평면 리스트로 가져온다.
List<Note> allNotes = noteRepository.findByCourseAndStudentOrderByCreatedAtAsc(course, student);

// 2. 자바 메모리에서 parentNoteId를 기준으로 그룹핑(Map)한다.
Map<Long, List<Note>> childrenByParentId = allNotes.stream()
        .filter(note -> note.getParentNote() != null)
        .collect(Collectors.groupingBy(note -> note.getParentNote().getNoteId()));

// 3. 최상위 루트 노드들만 고른다.
List<Note> rootNotes = allNotes.stream()
        .filter(note -> note.getParentNote() == null)
        .collect(Collectors.toList());

// 4. 메모리 상에서 재귀적으로 Tree DTO를 조립한다 (DB 접근 0회!).
return rootNotes.stream()
        .map(note -> convertToTreeResponse(note, childrenByParentId, 0))
        .collect(Collectors.toList());
```

> 💬 **쉽게 말하면**: 도서관에 책 찾으러 열 번 스무 번 들락날락하지 않고, **필요한 책을 카트에 한 번에 다 담아온 뒤(쿼리 1회) 책상 위에서 빠르게 트리 모양으로 정리**하는 방식입니다.

---

### 🔵 STEP 3. 새 노트 생성 시 "초기 Tiptap JSON" 주입

`NoteService.java`의 `createNote`:

```java
Note note = new Note();
note.setCourse(course);
note.setStudent(student);
note.setTitle("제목 없음");

// Tiptap 에디터가 인식할 수 있는 기본 JSON 구조를 문자열로 넣어둔다.
String initialContent = "{\"type\":\"doc\",\"content\":[{\"type\":\"heading\",\"attrs\":{\"level\":1},\"content\":[{\"type\":\"text\",\"text\":\"제목 없음\"}]}]}";
note.setContent(initialContent);

// 만약 하위 노트를 만드는 거라면 부모 검증 및 연결
if (parentNoteId != null) {
    Note parent = noteRepository.findById(parentNoteId).orElseThrow(...);
    validateParentNote(parent, courseId, studentNum); // 부모도 내 노트인지 확인
    note.setParentNote(parent);
}
```

> 💬 **쉽게 말하면**: 빈 종이를 그냥 주는 게 아니라, Tiptap 에디터가 고장 나지 않도록 H1 크기의 `"제목 없음"`이라는 제목 블록이 하나 미리 적혀 있는 JSON 규격 종이를 세팅해 줍니다.

---

### 🔵 STEP 4. 브레드크럼(Breadcrumbs, 빵부스러기 경로) 역추적

`NoteService.java`의 `convertToResponse`:

노트를 단건 조회(`GET /api/notes/{id}`)하면 상단 헤더에 `강의명 > 1주차 > 1교시` 같은 경로가 나옵니다.

```java
List<NoteResponse.NoteSummary> breadcrumbs = new ArrayList<>();
Note current = note.getParentNote();
while (current != null) {
    breadcrumbs.add(new NoteResponse.NoteSummary(current.getNoteId(), current.getTitle()));
    current = current.getParentNote(); // 부모의 부모를 타고 계속 올라감
}
Collections.reverse(breadcrumbs); // 역순으로 뒤집어 [할아버지, 아버지] 순서로 만듦
```

> 💬 **쉽게 말하면**: 현재 노드에서 `parentNote`를 타고 뿌리(Root)까지 거슬러 올라간 뒤, 순서를 뒤집어서 사용자가 보기 편한 왼쪽→오른쪽 경로로 만들어 줍니다.

---

### 🔵 STEP 5. 프론트엔드의 똑똑한 첫 진입 처리 (`useCourseNotes.js`)

강의실(`/course/3`)에 처음 딱 들어왔을 때 사용자가 노트를 클릭하지 않았어도 알아서 노트가 열려야 합니다.

`useCourseNotes.js`:

```javascript
// 최초 진입 시:
if (!noteId) {
  if (treeData.length > 0) {
    // 1. 이미 만들어진 노트가 있으면? 제일 첫 번째 노트로 자동 이동!
    navigate(`/course/${courseId}/note/${treeData[0].noteId}`, { replace: true });
  } else {
    // 2. 노트가 하나도 없는 새 강의실이면? 백엔드에 빈 노트를 하나 만들어주고 거기로 이동!
    const createRes = await client.post(`/courses/${courseId}/notes`);
    navigate(`/course/${courseId}/note/${createRes.data.noteId}`, { replace: true });
  }
}
```

> 💬 **쉽게 말하면**: 강의실에 들어왔는데 빈 화면만 멍하니 보이지 않도록, 기존 노트가 있으면 첫 노트를 열어주고, 없으면 새 노트를 하나 딱 펼쳐주는 친절한 안내원 역할을 프론트엔드 훅이 해줍니다.

---

## 6. 데이터가 어떻게 이동하는가?

```
[강의 페이지 접속: /course/1]
       ↓
[useCourseNotes 훅] ─── GET /api/courses/1/notes/tree ───→ [NoteController]
                                                                ↓
                                                         [NoteService]
                                                                ↓ (수강 여부 검증)
                                                         [NoteRepository]
                                                                ↓ SELECT * FROM notes WHERE course_id=1 AND stud_id=X
                                                         [DB notes 결과들]
                                                                ↓ (메모리 Grouping 변환)
                                                         [List<NoteTreeResponse>]
       ←──────────── JSON Tree 응답 반환 ───────────────────────┘
       ↓
[NoteTreeContext]에 트리 저장
       ↓
[사이드바 NoteTreeItem] 재귀 컴포넌트 렌더링
  ├── 📁 1주차 정리
  │    └── 📄 1교시 내용
  └── 📄 2주차 예습
       ↓
[사용자가 '1교시 내용' 클릭] → URL: `/course/1/note/5` 변경
       ↓
[useCourseNotes 훅] ─── GET /api/notes/5 ───→ [NoteController] → [NoteService] (소유권 검증)
       ←──────────── JSON (content, breadcrumbs) ───────────────┘
       ↓
[NotionEditor] 화면에 Tiptap 에디터 본문 렌더링
```

---

## 7. 왜 이렇게 설계했는가?

1. **왜 별도의 `folders` 테이블을 만들지 않고 `notes` 단일 테이블로 계층 구조를 만들었는가?**
   - 노션의 특징은 "모든 폴더가 곧 문서이고, 모든 문서 안에 하위 문서를 넣을 수 있다"는 점입니다.
   - 폴더 테이블과 문서 테이블을 나누면 구조가 복잡해지지만, `parent_note_id`를 갖는 **자기참조 모델**을 쓰면 모든 노드가 본문도 가질 수 있고 자식도 품을 수 있어 유연해집니다.

2. **왜 트리를 DB 재귀 쿼리(`WITH RECURSIVE`)나 Lazy Loading으로 만들지 않고 메모리에서 Map으로 조립했는가?**
   - 학생 한 명이 한 학기 동안 한 과목에 쓰는 노트는 많아야 수십~수백 개 수준입니다.
   - 이 정도 데이터양은 DB에서 한 번에 가져와 메모리에서 `groupingBy`로 묶는 것이 DB 쿼리 왕복 횟수(RTT)를 1회로 줄여서 훨씬 빠르고 안전합니다.

3. **왜 `validateParentNote` 검증이 필요한가?**
   - 과거 보안 이슈 중 하나로, 악의적인 사용자가 다른 사람의 노트 ID나 다른 과목의 노트 ID를 `parentNoteId`로 넘겨서 노트를 엉뚱한 곳에 기생시키는 문제(IDOR 취약점)가 있었습니다.
   - 이를 방지하기 위해 부모 노트를 지정할 때 **"부모 노트도 내 것인가?", "부모 노트도 같은 과목인가?"**를 철저히 검사하도록 설계되었습니다.

---

## 8. 초보자가 헷갈리기 쉬운 부분

| 헷갈리는 것 | 실제 동작 |
|---|---|
| `orphanRemoval = true` vs `CascadeType.REMOVE` | 둘 다 부모 삭제 시 자식을 지우지만, `orphanRemoval = true`는 부모의 자식 리스트 컬렉션에서 자식을 `remove()`해서 관계가 끊어졌을 때도 그 자식을 DB에서 완전히 고아(Orphan)로 보고 DELETE 해줍니다. |
| 트리 API에 본문(`content`)이 포함되나요? | **포함되지 않습니다.** 사이드바 목차를 그리는 트리 API(`NoteTreeResponse`)에는 `noteId`, `title`, `children`만 들어갑니다. 본문까지 다 넣으면 사이드바 열 때 데이터 통신량이 너무 커지기 때문입니다. |
| `MAX_TREE_DEPTH = 20`은 왜 있나요? | 만약 실수나 버그로 A가 B의 부모인데 B가 A의 부모가 되는 '순환 참조'가 생기면 재귀 함수가 무한 루프에 빠져 서버가 멈춥니다(StackOverflowError). 이를 막기 위한 20단계 깊이 안전장치입니다. |

---

## 9. 시험/면접에서 알아야 할 핵심

> **"계층형 트리 구조(Self-referencing Entity)를 JPA로 다룰 때 발생할 수 있는 문제와 그 해결책을 설명해 보세요."**

✅ 이렇게 설명할 수 있습니다:
> "계층형 엔티티에서 가장 흔한 문제는 **N+1 쿼리 문제**와 **순환 참조로 인한 무한 루프**입니다.  
> 자식 컬렉션을 단순히 `FetchType.LAZY`로 두고 트리 응답을 만들면 자식 노드를 순회할 때마다 추가 SELECT 쿼리가 발생해 성능이 크게 떨어집니다.  
> UniNote에서는 이를 해결하기 위해 부모-자식을 따라가며 조회하지 않고, 해당 강의와 학생의 노트를 **단 1번의 쿼리로 전체 평면 조회**한 뒤, 애플리케이션 메모리에서 `Map<Long, List<Note>>`로 그룹핑하여 트리를 조립했습니다.  
> 또한 DTO 변환 시 최대 깊이 제한(`MAX_TREE_DEPTH`)을 두어 혹시 모를 순환 참조 발생 시에도 스택오버플로우를 방지했습니다."

---

## 10. 이해 확인 문제 📝

**Q1. (쉬운 문제)**
최상위(Root) 노트와 하위(Child) 노트를 구분하는 `notes` 테이블의 핵심 컬럼명은 무엇인가요?

**Q2. (흐름 문제)**
학생이 사이드바에서 특정 부모 노트를 '삭제'하면 그 밑에 있던 하위 자식 노트들은 어떻게 되나요? 그리고 그것을 가능하게 해주는 `Note.java`의 JPA 설정은 무엇인가요?

**Q3. (코드 이해)**
`NoteService.java`의 `getNoteTree` 메서드에서 DB 쿼리는 왜 단 1번만 실행될까요?

**Q4. (설계 이해)**
새 노트를 생성할 때 `content` 컬럼을 빈 문자열(`""`)로 두지 않고, H1 태그가 들어간 특정한 JSON 문자열을 기본값으로 채워 넣는 이유는 무엇일까요?

**Q5. (면접형)**
사이드바를 그리는 '노트 트리 조회 API'와 특정 노트를 클릭했을 때 호출하는 '단건 노트 조회 API'로 엔드포인트를 분리한 이유를 네트워크 및 성능 관점에서 설명해 보세요.
