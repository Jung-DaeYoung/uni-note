# 현재 작업 계획: UniNote 야간모드 (완료)

## 진행 결과 (2026-09-15)

- `frontend/src/context/ThemeContext.jsx` 신규 — `uninote-theme` localStorage 키, 기본값 `light`(OS 설정 무시), `document.documentElement`에 `dark` 클래스 토글, 탭 간 storage 이벤트 동기화.
- `index.css`에 `@custom-variant dark (&:where(.dark, .dark *));` 한 줄 추가(Tailwind v4가 OS 설정 대신 `.dark` 클래스를 기준으로 삼도록).
- `main.jsx`에 `ThemeProvider`를 최상위(AuthProvider보다 바깥)로 배치.
- `AppLayout.jsx` 헤더에 Moon/Sun 토글 버튼 추가, 사이드바(`<aside>`)는 원래도 항상 어두운 디자인이라 변경하지 않음.
- 나머지 15개 파일(페이지 3, 에디터 핵심 1, 에디터 하위 컴포넌트 8, 게시판 1, 퀴즈 패널 3)에 `dark:` variant 클래스 추가. `NotionEditor.jsx`의 인라인 `<style>` 블록에는 `.dark ...` 규칙을 순수 추가(기존 규칙 무변경).
  - 계획 수립 시 목록에 있던 `NoteTreeItem.jsx`는 실제로 사이드바(`<aside>`) 안에서만 렌더링됨을 코드로 재확인해 제외(이미 항상-어두운 배경에 맞는 색상이라 변경 불필요).
- 의미 색상(정답=초록/오답=빨강/경고=호박/만점=에메랄드)은 옅은 배경을 `bg-*-500/10` 투명도 방식으로 변환해 다크 배경에서도 대비를 유지.
- 검증: `npm run lint`(22 errors/2 warnings — `ThemeContext.jsx`가 `AuthContext.jsx`/`CourseContext.jsx`와 동일한 기존 패턴의 `react-refresh/only-export-components`에 걸려 +1, 신규 버그 아님), `npm run build` 정상.
- 브라우저 라이브 검증(테스트 계정): 토글 클릭↔전환, localStorage 반영, 새로고침 유지, 손상된 값 → 라이트 폴백, 대시보드·강의상세·에디터·Slash Command(메뉴/방향키/Enter 선택/자동저장)·게시판(글 보기/댓글 작성)·퀴즈 보관함 3탭·퀴즈 풀이·결과 리포트(정답/오답 색상)·오답노트 재풀이·AI 문제 생성 모달까지 전부 다크 모드에서 정상 동작 확인. 라이트 모드 복귀도 회귀 없이 확인.

## 목표

로그인 이후 UniNote 전체 학습 화면에서 야간모드를 제공한다. 노트 작성과 퀴즈 풀이를 오래 사용하는 사용자의 눈 피로를 줄이고, 기존 UI·API·DB 계약을 유지하면서 프론트엔드 테마 전환 기능을 추가한다.

## 적용 범위

- 대시보드
- 강의 상세 화면
- Tiptap 노트 에디터
- 노트 트리와 페이지 링크
- 익명 게시판과 댓글
- 퀴즈 보관함
- 퀴즈 풀이·결과 화면
- 오답노트
- 모달·입력창·상태 메시지
- 공통 레이아웃과 상단 헤더

## 제외 범위

- 백엔드 API 및 DB 변경
- 사용자 테마 설정의 서버 저장
- 운영자 테마 설정
- 사용자 지정 색상 테마
- 고대비 모드
- 모바일 전용 별도 테마
- 로그인 화면의 전면 테마 재설계

## 작업 원칙

- 기존 기능과 API 응답 계약을 변경하지 않는다.
- 기존 라이트모드의 화면 동작과 시각적 계층을 유지한다.
- 색상만 어둡게 바꾸지 말고 텍스트·테두리·입력·hover·focus·disabled 상태의 대비를 함께 조정한다.
- 새로운 테마 라이브러리를 추가하지 않는다.
- 공통 테마 상태와 기존 Tailwind 클래스 패턴을 재사용한다.
- Slash Command, 자동 저장, 업로드, 퀴즈 풀이 로직은 변경하지 않는다.
- 관련 없는 사용자 변경 사항을 덮어쓰거나 되돌리지 않는다.

# 1. 현재 UI 구조와 색상 기준 확인

## 확인 대상

- `frontend/src/index.css`
- `frontend/src/App.css`
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/components/layout/AppLayout.jsx`
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/pages/CourseDetailPage.jsx`
- `frontend/src/pages/QuizLibraryPage.jsx`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/course/CourseBoardPanel.jsx`
- `frontend/src/components/quiz/`
- `frontend/src/components/editor/components/`

## 확인 내용

- `bg-white`, `bg-slate-*`, `text-slate-*`, `border-slate-*` 사용 위치를 파악한다.
- Tiptap 내부 콘텐츠와 모달의 별도 스타일을 확인한다.
- 현재 사이드바의 어두운 색상과 코드 블록의 `atom-one-dark` 테마가 다크 테마와 충돌하지 않는지 확인한다.
- 기존 라이트모드에서 유지해야 할 주요 상태 스타일을 목록화한다.

# 2. 테마 상태와 저장 구현

## 구현 방향

1. `ThemeContext` 또는 동일한 책임의 `useTheme` 구조를 추가한다.
2. 테마 상태는 `light`와 `dark`를 지원한다.
3. `localStorage` 키는 `uninote-theme`로 사용한다.
4. 초기 로딩 시 저장된 테마를 복구한다.
5. `document.documentElement`에 `dark` 클래스를 적용·제거한다.
6. 저장값이 없거나 유효하지 않으면 `light`를 기본값으로 사용한다.
7. 테마 변경 시 새로고침 후에도 설정이 유지되도록 한다.

## 보호할 동작

- AuthContext의 로그인·로그아웃 동작
- CourseContext의 강의 데이터 조회
- 라우팅과 ProtectedRoute
- JWT 저장·복구
- 노트 자동 저장과 localStorage 임시 저장 키

# 3. 공통 레이아웃 테마 전환

## 대상

- `frontend/src/main.jsx`
- `frontend/src/components/layout/AppLayout.jsx`
- `frontend/src/index.css`

## 구현 방향

1. 애플리케이션 루트에 테마 Provider를 배치한다.
2. `AppLayout` 상단 헤더에 야간모드 토글 버튼을 추가한다.
3. 토글 버튼은 현재 상태를 아이콘·`title` 또는 접근 가능한 라벨로 표시한다.
4. `html.dark` 기준의 전역 배경·텍스트·스크롤 동작을 정의한다.
5. 기존 사이드바의 어두운 색상은 중복되거나 과도하게 변경하지 않는다.
6. 테마 전환 시 화면 깜빡임과 레이아웃 이동을 최소화한다.

## 색상 기준

| 용도 | 라이트모드 | 야간모드 |
|---|---|---|
| 전체 배경 | `slate-50` | `slate-950` |
| 카드 | `white` | `slate-900` |
| 기본 텍스트 | `slate-900` | `slate-100` |
| 보조 텍스트 | `slate-500` | `slate-400` |
| 테두리 | `slate-100/200` | `slate-700` |
| 입력 배경 | `slate-50` | `slate-800` |
| 주요 강조 | 기존 blue 계열 | 기존 blue 계열 유지 |

# 4. 핵심 학습 화면 적용

## 적용 순서

1. `DashboardPage`
2. `CourseDetailPage`
3. `NotionEditor`
4. 노트 트리·페이지 링크
5. `CourseBoardPanel`
6. `QuizLibraryPage`
7. `CBTPlayer`
8. `IncorrectGroupsPanel`
9. 퀴즈·오답 관련 모달

## 적용 기준

- 페이지 배경과 카드 배경을 야간 색상으로 변경한다.
- 제목·본문·보조 설명의 대비를 확보한다.
- 테두리와 구분선을 야간 배경에서 식별 가능하게 조정한다.
- 입력창, placeholder, 버튼의 hover·focus 상태를 함께 조정한다.
- 정답·오답·경고·성공 색상은 의미가 유지되도록 명도와 배경을 조절한다.
- 게시판의 익명 사용자 표시와 댓글 구분이 야간에도 명확해야 한다.

# 5. Tiptap 에디터와 콘텐츠 블록 점검

## 대상

- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/editor/components/BlockHandle.jsx`
- `frontend/src/components/editor/components/CodeBlockComponent.jsx`
- `frontend/src/components/editor/extensions/PdfBlock.jsx`
- `frontend/src/components/editor/extensions/PageLink.jsx`
- `frontend/src/components/editor/components/SuggestionList.jsx`

## 점검 항목

- 본문·제목·placeholder 색상
- 선택 영역과 커서 주변 상태
- 인용구·링크·목록·체크박스
- 코드 블록과 `atom-one-dark` highlight 테마
- 이미지·PDF 블록 배경과 버튼
- Slash Command 메뉴와 검색 결과
- Block handle과 hover 상태
- 업로드 진행·실패 배너

## 제한

- 에디터 저장 JSON 형식을 변경하지 않는다.
- 이미지·PDF URL 검증 로직을 변경하지 않는다.
- Slash Command 메뉴 구성, 필터링, 우선순위와 실행 로직을 변경하지 않는다.

# 6. 사용자 상태와 접근성 보완

## 확인 대상

- hover
- focus
- active
- disabled
- error
- success
- loading
- placeholder
- modal backdrop
- scrollbar

## 구현 기준

- 토글 버튼에 키보드 접근성과 접근 가능한 이름을 제공한다.
- 야간모드에서 텍스트와 주요 컨트롤의 대비를 확인한다.
- 색상만으로 정답·오답 상태를 구분하지 않고 기존 아이콘·문구를 유지한다.
- 모달 backdrop이 콘텐츠를 충분히 구분하되 과도하게 밝지 않도록 한다.

# 7. 검증

## 기능 검증

- 라이트모드와 야간모드 전환
- 새로고침 후 테마 유지
- 로그인·로그아웃 후 테마 유지
- 대시보드·강의·노트·게시판·퀴즈·오답노트 화면 이동
- 모달 열기·닫기
- 노트 편집·자동 저장
- 이미지·PDF 표시
- Slash Command 전체 동작
- 퀴즈 풀이·결과·오답노트 재풀이

## 명령어

- `frontend\npm.cmd run lint`
- `frontend\npm.cmd run build`

## 완료 조건

- 헤더에서 야간모드를 켜고 끌 수 있다.
- 선택한 테마가 새로고침 후 유지된다.
- 모든 주요 보호 화면이 야간모드에서 깨지지 않는다.
- 노트 에디터와 퀴즈 풀이가 야간모드에서도 정상적으로 사용할 수 있다.
- 입력·모달·오류·정답·오답 상태의 대비가 확보된다.
- 기존 자동 저장·업로드·게시판·퀴즈·오답노트 동작이 유지된다.
- 프론트 lint와 build가 통과한다.

# 실행 순서

```text
현재 UI와 색상 사용 확인
→ 테마 상태·localStorage 구현
→ AppLayout 토글 연결
→ 전역 레이아웃·대시보드 적용
→ 노트 에디터·노트 트리 적용
→ 게시판·퀴즈·오답노트 적용
→ 모달·입력·상태 스타일 보완
→ 에디터·업로드·Slash Command 회귀 확인
→ lint/build 실행
```
