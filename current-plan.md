# 노트 화면 상단 액션 디자인 정리 계획

## 목표

노트 화면 오른쪽 위의 `AI 문제 생성`, `노트 공유`, `저장됨`, `커뮤니티`, `이름 변경`, `강의 삭제` 액션을 현재 `마이페이지`, `오답노트`, `나의 CBT 시험`에서 사용하는 깔끔한 목록형 디자인 언어와 통일한다.

- 기존 기능, API, 상태 처리, 라우트는 유지한다.
- 버튼이 서로 경쟁하지 않도록 주요 액션과 상태 표시의 위계를 분리한다.
- 과도한 pill, 강한 배경색, 작은 텍스트, 기본 Tailwind 스타일 반복을 줄인다.
- 라이트·다크 모드, 키보드 접근성, 모바일 헤더 대응을 함께 보존한다.

## 현재 기준

대상은 `frontend/src/pages/CourseDetailPage.jsx`의 `headerContent` 영역이다.

- `AI 문제 생성`: 파란색 tinted 배경의 액션 버튼
- `노트 공유`: 흰색 배경과 테두리의 액션 버튼
- `저장됨`: 상태 dot와 tinted 배경을 가진 상태 표시
- `커뮤니티`: 닫힘 상태는 흰색 버튼, 열림 상태는 어두운 filled 버튼
- `이름 변경`, `강의 삭제`: 사용자 생성 강의에서 `커뮤니티`와 `노트 공유` 대신 같은 그룹에 표시되는 버튼

참고할 기존 스타일:

- `frontend/src/pages/QuizLibraryPage.css`의 `.lib-btn`, `.lib-icon`, `.lib-tab`
- `frontend/src/pages/MyPage.css`의 `.my-row`, `.my-row-meta`
- `frontend/src/pages/IncorrectNotesPage.css`의 요약·액션 스타일
- `frontend/src/pages/SharedBoard.css`의 게시판 액션 및 상태 스타일

## 디자인 방향

### 1. 공통 액션 형태

- 모든 액션을 동일한 높이와 수직 정렬로 맞춘다.
- `padding`, `border`, `font-size`, `font-weight`, `gap`, `focus ring`은 `.lib-btn`과 `--lib-*` 토큰으로 통일하고, 새 액션 토큰은 만들지 않는다.
- 액션 버튼은 얇은 테두리와 명확한 텍스트 중심으로 구성한다.
- 아이콘은 보조 역할로 유지하고, 아이콘만으로 기능을 전달하지 않는다. 유일한 예외는 아래 `헤더 배치`의 좁은 헤더 축소이며, 이때도 숨김 글자로 접근 가능한 이름을 유지한다.
- 반경은 기존 `lib` 계열의 절제된 값으로 맞추며 `rounded-xl`, `rounded-2xl`, pill 형태는 사용하지 않는다.
- 버튼마다 다른 강한 색상 배경을 사용하지 않고 기본·주요·위험·상태 역할로만 구분한다.

### 2. 액션 우선순위

| 요소 | 역할 | 시각적 우선순위 |
| --- | --- | --- |
| AI 문제 생성 | 노트에서 수행하는 주요 작업 | accent 글자와 얇은 테두리 |
| 노트 공유 | 조건부 콘텐츠 공유 | secondary outline action |
| 저장 상태 | 조작 대상이 아닌 시스템 상태 | neutral status |
| 커뮤니티 | 패널 열기·닫기 | secondary action, 활성 상태만 강조 |
| 이름 변경 | 사용자 생성 강의 관리 | secondary outline action |
| 강의 삭제 | 사용자 생성 강의 삭제 | danger 글자와 얇은 테두리 |

- `AI 문제 생성`은 가장 눈에 띄되 큰 filled button으로 과장하지 않는다. 어두운 채움 버튼인 `.lib-btn-primary`는 쓰지 않는다.
- `노트 공유`는 저장 완료 상태에서만 활성화되는 조건을 시각적으로 명확히 한다.
- `저장됨`은 버튼처럼 보이지 않도록 상태 표시 전용 구조로 구분한다.
- `커뮤니티` 열림 상태는 `--lib-color-hover` 배경과 진한 테두리로 표시하고, 어두운 filled 버튼은 쓰지 않는다.

### 3. 상태와 문구

- 저장 상태의 기존 문구와 의미를 유지한다.
  - `저장 중...`
  - `오류`
  - `저장됨`
  - 오류 시 `재시도`
- 저장 상태 dot는 장식이 아니라 실제 상태를 나타내는 보조 표시로 유지한다.
- 저장 오류 시 재시도 버튼이 작은 밑줄 링크로 묻히지 않도록 기존 목록형 액션과 같은 focus·hover·active 규칙을 적용한다.
- 공유 버튼 disabled 상태의 이유를 `title`과 시각적 대비로 유지한다.
- 커뮤니티가 열렸을 때 문구 `닫기`와 닫혔을 때 `커뮤니티`를 유지한다.

## 구현 범위

### 1차 수정 대상

- `frontend/src/pages/CourseDetailPage.jsx`
  - 노트 상단 액션의 className을 공통 스타일 클래스로 교체
  - 기존 `onClick`, `disabled`, `title`, 상태 문구, 조건부 렌더링 유지
  - 상단 액션의 DOM 의미와 접근성 속성 보존. 유일한 접근성 속성 변경은 저장 상태 문구의 `role="status"` 추가다.
  - 마이페이지, 오답노트, 게시판과 같은 방식으로 `QuizLibraryPage.css`와 새 CSS를 import

- `frontend/src/pages/CourseDetailPage.css` (신규)
  - `.lib-btn`과 `--lib-*` 색상 토큰을 재사용하고 부족한 값만 보완
  - 헤더 액션 그룹에 `--dur-micro`, `--ease-out`을 선언한다. 이 값은 `.lib` 안에만 있어 헤더에서는 비어 있다.
  - `flex: none`과 아이콘 정렬(`inline-flex`, `gap`)을 보완한다.
  - 헤더에 `.lib` 클래스를 붙이지 않는다. `html:has(.lib)` 규칙이 작동하기 때문이다.

### 수정하지 않는 대상

- `frontend/src/pages/QuizLibraryPage.css`, `frontend/src/index.css`: 다른 화면에 영향을 주지 않도록 수정하지 않는다.
- 모바일 사이드바: 이번 범위에서 제외한다.

### 확인 대상

- `frontend/src/components/layout/AppLayout.jsx`
  - 액션 그룹이 `shrink-0`이고 헤더 콘텐츠가 `overflow-hidden`이라 좁은 폭에서 잘릴 수 있다. 헤더 콘텐츠의 클리핑을 확인하고, 필요한 경우에만 최소한으로 조정한다.

## 구체적인 스타일 작업

### 액션 버튼

- 높이를 기존 `.lib-btn` 계열과 맞춘다.
- 텍스트 크기는 노트 제목·breadcrumb보다 작되 기능을 읽을 수 있는 크기로 유지한다.
- `background-color`, `color`, `border-color`, `scale`만 명시적으로 transition한다.
- `:hover`는 마우스·트랙패드 환경에서만 적용한다.
- `:active`에는 기존 `.lib-btn:active`와 같은 `scale: 0.97`을 적용한다.
- `:focus-visible`은 기존 목록 화면과 동일한 accent outline 규칙을 사용한다.
- disabled는 opacity만 낮추지 말고 cursor와 대비로 비활성 상태를 명확히 한다.

### 저장 상태

- 버튼과 구분되는 inline status로 표시한다. 현재 코드에는 `role`이 없으므로 상태 문구 `span`에만 `role="status"`를 새로 붙이고, `재시도` 버튼은 그 밖에 둔다.
- 상태 배경은 화면을 지배하지 않는 neutral surface로 통일한다.
- 저장 중 점의 `animate-pulse`는 유지하되 `prefers-reduced-motion`에서 끈다.
- 오류 상태는 색상만으로 구분하지 않고 문구와 재시도 액션을 함께 표시한다.

### 헤더 배치

- 넓은 화면에서는 breadcrumb와 액션 그룹이 서로 밀어내지 않도록 `min-width: 0`, `flex-shrink`, `overflow`를 정리한다.
- 1024px 전후에서는 액션 간격을 줄이고 텍스트가 잘리지 않도록 한다.
- 좁은 헤더에서는 액션을 아이콘 버튼으로 축소하고, 글자는 시각적으로만 숨겨 접근 가능한 이름을 유지한다. `title`도 함께 둔다.
- 축소 기준은 뷰포트가 아니라 헤더 폭이다. 사이드바 때문에 같은 뷰포트에서도 본문 폭이 달라지므로 컨테이너 쿼리를 쓴다.
- 저장 상태는 좁은 헤더에서 점과 숨김 글자로 줄이되, 오류일 때는 `오류`와 `재시도`를 계속 보이게 한다.
- 다음 방식은 쓰지 않는다.
  - 보조 행: 헤더 높이 48px를 전제한 `h-[calc(100vh-48px)]`가 깨진다.
  - overflow 메뉴: 새 상태와 키보드 처리가 필요해 기능 유지 원칙과 맞지 않는다.

## 보존해야 할 동작

- `AI 문제 생성` 클릭 시 `setIsQuizModalOpen(true)`
- `노트 공유` 클릭 시 `handleShareNote(...)`
- 저장 완료 전 노트 공유 disabled
- 저장 실패 시 `saveState.retry`
- `커뮤니티` 클릭 시 게시판 열기·닫기와 키워드 패널 닫기
- 사용자 생성 강의에서는 기존 `이름 변경`, `강의 삭제` 액션이 계속 표시됨
- 공유·삭제·퀴즈 생성에 대한 기존 모달과 API 호출 유지
- 기존 라우트, 상태 이름, 테스트 선택자, 접근성 속성 보존

## 구현 순서

1. Hallmark 삭제 정리 변경을 먼저 커밋해 이번 변경과 섞이지 않게 한다.
2. 작업 시작 전 `git status --short`로 사용자 변경 사항을 확인한다.
3. `CourseDetailPage.jsx`의 현재 스타일과 헤더 폭을 확인한다.
4. `CourseDetailPage.css`를 추가하고 `QuizLibraryPage.css`와 함께 import한다.
5. 모든 액션의 className과 상태 스타일을 한 번에 교체한다.
6. 320px, 375px, 768px, 1024px, 1440px에서 헤더 배치를 확인한다. 320px와 375px는 사이드바를 접은 상태로 확인한다. 사이드바가 `w-64`로 고정되어 펼친 상태에서는 본문이 56~119px뿐이기 때문이다. 1024px는 사이드바를 펼친 조합도 확인한다.
7. 라이트·다크 모드와 저장 중·저장 오류·공유 disabled·커뮤니티 open 상태를 확인한다.
8. 변경 범위와 기존 동작을 diff로 검토한다.

## 검증

- `cd frontend; npm run lint`
- `cd frontend; npm run build`
- `cd frontend; npm run test`
  - `CourseDetailPage`를 직접 검사하는 테스트가 없으므로(`App.test.jsx`는 mock) 클릭 동작은 수동으로 확인한다.
- 수동 확인:
  - 각 액션의 클릭 동작: 퀴즈 모달, 공유 확인, 재시도, 커뮤니티 열기·닫기
  - 노트 없이 `/course/:id`만 연 상태
  - 노트가 없는 상태
  - 노트 로딩 및 노트 제목이 긴 상태
  - 저장 중
  - 저장됨
  - 저장 오류 및 재시도
  - 저장 완료 전 공유 disabled
  - 공유 가능 상태
  - 커뮤니티 닫힘·열림
  - 사용자 생성 강의의 이름 변경·삭제 액션
  - 라이트·다크 모드
  - 키보드 focus-visible
  - reduced motion

## 완료 기준

- 상단 액션 전체가 마이페이지·오답노트·나의 CBT 시험의 액션 스타일과 시각적으로 일관된다.
- AI 문제 생성만 과도하게 튀지 않고, 각 액션의 역할이 명확하다.
- 저장 상태는 버튼으로 오인되지 않으며 오류와 재시도가 분명하다.
- 커뮤니티 열림 상태가 기존 기능을 유지하면서도 전체 헤더를 무겁게 만들지 않는다.
- 사이드바를 접은 320px 이상의 화면에서 액션이 겹치거나 가려지지 않는다.
- 기능/API/상태/접근성 계약이 깨지지 않는다.
