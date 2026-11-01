# UniNote 프론트엔드 디자인 개선 계획

## 목표

- 기존 기능과 API 계약을 유지하면서 프론트엔드의 시각적 완성도를 높인다.
- `slate + blue + 둥근 카드 + Tailwind 대시보드`의 반복을 줄여 AI가 만든 듯한 인상을 없앤다.
- 트렌디하지만 과장되지 않은 UniNote 고유의 디자인 언어를 만든다.
- 화면별 목적과 사용 흐름이 시각적으로 분명하게 느껴지도록 한다.
- 접근성, 반응형, 자동 저장, 인증 및 기존 상호작용을 보존한다.

이 계획은 `PLANS.md`의 P0(보안)와 별개인 디자인 트랙이며, 사용자가 결정해 먼저 진행한다. 아래 `D0`~`D2`는 이 계획 안에서의 우선순위다.

## 디자인 방향

Hallmark 실행 전에 확정한 값이다.

- **실행 방식:** `/hallmark redesign <대상>`(full 깊이), `--scope app`. 경로, 라우트, 컴포넌트 로직은 유지한다.
- **유지:** 줄 구분 목록, 다크 로그인, 라이트·다크 모드, 기능 아이콘.
- **교체:** Tailwind 기본 slate·blue 팔레트, 강한 굵기, 작은 메타 라벨. 현재 파란 U 로고는 브랜드 자산으로 보지 않는다.
- **토큰 연결:** `frontend/src/index.css`의 토큰을 Tailwind v4 `@theme`에 연결하고, JSX의 색상 유틸리티를 화면 작업 시 함께 옮긴다. 현재 JSX 18개 파일 364줄에 기본 색상 클래스가 있다.
- **시스템 고정:** 여러 화면을 다루므로 `design.md`를 필수 산출물로 만든다.
- **폰트:** Pretendard woff2를 저장소에 직접 포함한다. `frontend/index.html` CSP가 `font-src 'self'`이고 현재 폰트 파일이 없다.

## 적용 원칙

- **Hallmark**: 공통 디자인 시스템, 화면 구성, 타이포그래피, 색상, 표면, 레이아웃을 재정의한다.
- **Emil design engineering**: 버튼 피드백, 패널·모달 전환, 저장 상태, 로딩·오류 상태를 정교하게 다듬는다.
- 기능 로직과 API 호출은 변경하지 않고, 소유 컴포넌트 내부의 마크업과 스타일만 필요한 범위에서 수정한다.
- 로직 변경 예외는 `AppLayout.jsx`의 작은 화면 사이드바 초기 상태와 모바일 overlay 전환뿐이다. 현재 `w-64` 고정이라 320px에서 본문이 56px만 남아, 이 변경 없이는 반응형 완료 기준을 맞출 수 없다.
- 기존 라우트, 폼 필드, `id`, `name`, `data-testid`, 이벤트 핸들러, 테스트 계약을 유지한다.
- 색상과 폰트는 전역 또는 화면 토큰을 통해 관리하고, 화면별 임의 색상 사용을 줄인다.
- 애니메이션은 목적이 있을 때만 사용하며 `transform`, `opacity` 중심으로 기본 150~250ms, 예외도 300ms 이하로 설계한다.
- 모든 인터랙티브 요소에 `:focus-visible`을 제공한다. disabled, loading, error, empty는 로직이 이미 있는 상태만 표현하고, 없는 상태는 `후속 작업`에 기록한다.
- `prefers-reduced-motion`을 지원하고 모바일에서 hover 의존 동작을 사용하지 않는다.

## 우선순위별 개선 대상

### D0. 공통 레이아웃과 디자인 시스템

대상:

- `frontend/src/components/layout/AppLayout.jsx`
- `frontend/src/index.css`
- 화면별 CSS 토큰 및 반복 스타일
- 신규 `design.md`
- Pretendard woff2 파일
- 공통 구성요소
  - `frontend/src/context/ConfirmContext.jsx`
  - `frontend/src/components/quiz/QuestionComments.jsx`(게시판과 CBT 결과가 함께 사용)
  - `frontend/src/components/shared-notes/SharedNoteViewer.jsx`
- `QuizLibraryPage.css`의 `lib-` 클래스는 여러 화면이 공유하므로, 수정 시 관련 화면을 모두 확인한다.

작업:

- 사이드바와 상단 헤더를 UniNote의 핵심 브랜드 구조로 재정의한다.
- 메뉴는 라벨과 그룹 순서만 학습 목적 중심으로 조정하고, 목적지는 유지한다.
- 전역 색상, 배경, 텍스트, 테두리, 간격, 반경, 그림자, 타입 스케일을 통합한다.
- `--dash-*`, `--lib-*`, `--login-*`처럼 화면별로 분산된 토큰의 공통 축을 정리한다.
- 기본 Tailwind 색상과 반복적인 `rounded-*`, `font-black`, 작은 uppercase 메타 표현을 줄인다.
- 라이트·다크 모드가 같은 시스템 안에서 자연스럽게 대응하도록 토큰을 구성한다.
- 사이드바 접기, 모바일 네비게이션, sticky header의 반응형 동작을 검토한다.

완료 기준:

- 모든 화면이 같은 토큰과 글꼴을 쓴다.
- 공통 토큰만 조정해 색상과 밀도를 일관되게 변경할 수 있다.
- 320px부터 데스크톱까지 가로 스크롤이나 레이아웃 충돌이 없다.

### D0. 강의 상세 및 노트 에디터

대상:

- `frontend/src/pages/CourseDetailPage.jsx`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/course/NoteTreeItem.jsx`
- `frontend/src/components/course/CourseBoardPanel.jsx`
- `frontend/src/components/editor/components/KeywordExplainPanel.jsx`
- `frontend/src/components/editor/components/KeywordSelectionMenu.jsx`
- `frontend/src/components/editor/components/BlockHandle.jsx`
- `frontend/src/components/editor/components/SuggestionList.jsx`
- 업로드 및 자동 저장 관련 UI

작업:

- 노트 트리, 에디터, 게시판 패널, 키워드 패널의 우선순위를 명확히 한다.
- 노트 작성에 집중할 수 있도록 에디터 영역을 핵심 작업대로 재구성한다.
- breadcrumb와 상단 액션을 축소하고 현재 노트의 제목, 저장 상태, 주요 액션을 명확히 구분한다.
- `CourseDetailPage.jsx`에 이미 있는 `저장 중`, `저장됨`, `오류`, `재시도`의 표현을 개선한다.
- 게시판 패널과 키워드 패널이 동시에 열릴 때의 충돌과 모바일 overlay 동작을 정리한다.
- slash command, block handle, tooltip, context action의 진입·퇴장과 focus 상태를 개선한다.
- 에디터 내부의 작은 글자, 과도한 pill, 장식성 아이콘을 줄이고 콘텐츠 위계를 강화한다.

완료 기준:

- 사용자가 현재 강의·노트·저장 상태를 즉시 파악할 수 있다.
- `xl` 이상에서는 패널이 열려도 에디터의 주요 콘텐츠와 조작이 가려지지 않는다. 그 미만에서는 패널이 overlay로 열리고 닫기 경로가 분명하다.
- 자동 저장 실패 상태와 재시도 경로가 분명하다.

### D0. 퀴즈 풀이와 결과 화면

대상:

- `frontend/src/components/editor/components/CBTPlayer.jsx`
- `frontend/src/components/editor/components/QuizConfigModal.jsx`
- `frontend/src/components/editor/components/QuizAttemptsModal.jsx`
- `frontend/src/pages/QuizLibraryPage.jsx`
- `frontend/src/components/quiz/QuizListPanel.jsx`
- `frontend/src/components/quiz/QuizHistoryPanel.jsx`

작업:

- 카드, pill, 작은 uppercase 라벨의 반복을 줄이고 시험 화면을 차분한 학습 공간으로 만든다.
- 문제 번호, 진행 상태, 답안 영역, 제출 액션의 위계를 재설계한다.
- 풀이 중에는 집중을 우선하고, 결과 화면에서는 점수보다 학습 피드백을 우선한다.
- 오답 문항에서 `해설`, `원문 보기`, `오답노트 담기`의 흐름을 명확히 한다.
- 퀴즈 생성 모달의 설정 단계를 학생의 의사결정 순서에 맞게 그룹화한다.
- 제출 중, 저장 실패, 빈 문제, 결과 없음 상태를 명확히 표현한다.
- 문제 전환과 모달은 짧고 즉각적인 전환을 사용하며 키보드 조작에는 불필요한 애니메이션을 넣지 않는다.

완료 기준:

- 풀이 중 시선이 문제와 답안에 집중된다.
- 결과 화면에서 다음 학습 행동을 바로 선택할 수 있다.
- 기존 채점, 저장, 출처 이동, 댓글, 오답노트 연결 동작이 유지된다.

### D0. 오답노트

대상:

- `frontend/src/pages/IncorrectNotesPage.jsx`
- `frontend/src/pages/IncorrectNotesPage.css`
- `frontend/src/components/quiz/IncorrectGroupsPanel.jsx`
- `frontend/src/components/quiz/TodayReviewList.jsx`
- `frontend/src/components/quiz/WeakAreaBreakdown.jsx`
- `frontend/src/components/quiz/IncorrectSummaryCards.jsx`
- `frontend/src/components/editor/components/IncorrectNoteModal.jsx`

작업:

- 요약 수치, 오늘의 복습, 취약 영역, 오답노트 모음의 위계를 새 디자인 시스템에 맞춘다.
- 기존 `다시 풀기`와 오답노트 저장 흐름의 시각적 우선순위를 분명히 한다.

완료 기준:

- 오늘의 복습과 다시 풀기 동작이 기존과 같다.
- 기존 테스트가 확인하는 `25% · 4회` 문구를 유지한다.

### D1. 대시보드

대상:

- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/pages/DashboardPage.css`

작업:

- 현재 ruled list 중심 구성을 유지하되, 첫 화면의 대표 행동을 `DashboardResponse`의 `recentNotes`로 표시하는 “최근 노트 이어 쓰기”로 명확히 한다. 새 API 호출은 추가하지 않는다.
- 최근 노트, 수강 강의, 최신 커뮤니티의 우선순위를 재배치한다.
- 대시보드와 마이페이지의 역할을 구분한다.
- 활동 시각화는 마이페이지에만 둔다.
- 동일한 리스트 패턴 안에서도 대표 콘텐츠와 보조 콘텐츠의 밀도와 시각적 무게를 다르게 한다.

완료 기준:

- 최근 노트가 있으면 첫 화면에서 한 번의 선택으로 이어 쓸 수 있다.
- 대시보드가 단순 목록이 아니라 학습 흐름의 시작점으로 읽힌다.

### D1. 마이페이지와 활동 시각화

대상:

- `frontend/src/pages/MyPage.jsx`
- `frontend/src/pages/MyPage.css`
- `frontend/src/components/mypage/ActivityHeatmap`

작업:

- GitHub형 히트맵을 단순 활동량 표시가 아니라 학습 리듬을 이해하는 도구로 보강한다.
- 전체 통계, 강의별 현황, 최근 활동, 내 콘텐츠의 정보 우선순위를 조정한다.
- 숫자만 크게 나열하는 통계 구성을 줄이고, 기존 `/incorrect-notes` 링크로 복습 행동과 연결한다.
- 긴 목록의 날짜·메타 정보 밀도와 모바일 가독성을 개선한다.
- 빈 상태와 데이터 없음 상태를 낙담시키지 않으면서 다음 행동을 제시하도록 만든다.

완료 기준:

- 활동 히트맵, 통계, 내 콘텐츠의 기존 데이터와 이동 동작이 유지된다.
- 마이페이지에서 `/incorrect-notes`로 바로 이동할 수 있다.
- 320px에서 가로 스크롤 없이 목록과 메타 정보를 읽을 수 있다.

### D1. 게시판과 댓글

대상:

- `frontend/src/components/course/CourseBoardPanel.jsx`
- `frontend/src/pages/SharedNoteBoardPage.jsx`
- `frontend/src/pages/SharedQuizBoardPage.jsx`
- `frontend/src/pages/SharedBoard.css`
- 댓글 관련 컴포넌트

작업:

- `rounded card`가 반복되는 목록을 줄이고 제목·강의·댓글·최근 활동이 자연스럽게 읽히는 목록으로 개선한다.
- 익명성은 유지하되 작성자, 본인 게시물, 수정·삭제 가능 상태를 명확히 구분한다.
- 작성, 수정, 삭제, 댓글 전송의 성공·실패 피드백을 정교하게 한다.
- 우측 패널, 최대화, 모바일 화면 전환을 하나의 공간 모델로 통합한다.
- 빈 게시판에서 사용자가 무엇을 할 수 있는지 안내하되 불필요한 장식은 넣지 않는다.

완료 기준:

- 작성, 수정, 삭제, 댓글 전송과 익명 마스킹, 권한 동작이 유지된다.
- 본인 글은 기존 `isAuthor` 값으로 구분되고, 수정·삭제 가능 여부가 분명하다.
- 우측 패널, 최대화, 작은 화면에서 게시판을 열고 닫는 경로가 분명하다.

### D2. 로그인 화면

대상:

- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/LoginPage.css`

작업:

- 현재의 절제된 다크 로그인 방향은 유지하되 UniNote가 학습 도구라는 정체성을 최소한의 시각 언어로 강화한다.
- 입력 오류, 로딩, focus, disabled 상태의 대비와 피드백을 점검한다.
- 중앙 로그인 템플릿을 그대로 장식하기보다 워드마크, 입력 리듬, 여백으로 완성도를 높인다.

완료 기준:

- 로그인 성공, 실패, 로딩 동작과 `LoginPage.test.jsx`가 유지된다.
- 다크 배경에서 입력 오류, focus, disabled 상태를 구분할 수 있다.

## 공통 상호작용 개선 체크리스트

- 버튼 press 상태에 `scale(0.97)` 수준의 즉각적인 피드백을 필요한 경우에만 적용한다.
- `transition: all`을 사용하지 않고 실제 변경 속성만 지정한다.
- UI 전환은 기본적으로 `ease-out` 계열을 사용하고, 기본 150~250ms, 예외도 300ms 이하로 한다.
- popover와 tooltip은 trigger 방향을 기준으로 transform origin을 설정한다.
- 모달은 중앙 기준을 유지하고, drawer·side panel은 열리는 방향과 일치하는 origin을 사용한다.
- 자주 반복되는 키보드 액션에는 불필요한 애니메이션을 넣지 않는다.
- hover 스타일은 `hover: hover`와 `pointer: fine` 환경에서만 적용한다.
- 모든 애니메이션에 reduced-motion 대체 동작을 제공한다.
- loading UI가 콘텐츠를 갑자기 밀어내지 않도록 공간을 예약한다.
- 오류는 조용히 무시하지 않는다. 복구 로직이 이미 있는 오류만 복구 액션을 표현하고, 없는 경우는 `후속 작업`에 기록한다.

## Hallmark 검증 기준

- 공통 및 변경 화면의 모든 색상과 폰트가 토큰을 사용한다.
- 테마, 글꼴, 강조색은 공유하고 화면별 구성만 다르게 한다.
- 동일한 카드·리스트·버튼 패턴의 반복이 의도적으로 관리된다.
- 작은 uppercase 라벨, 장식성 eyebrow, 중복 meta 문자열, 기본 그라디언트를 사용하지 않는다.
- 카드 안의 카드, 과도한 pill, 프레임워크 기본 색상 의존을 제거한다.
- 컨테이너 폭과 이미지·그리드 트랙이 반응형 기준을 충족한다.
- 주요 제목, 설명, 액션의 정보량이 한 화면에서 과밀하지 않다.
- 실제 제품 콘텐츠와 데이터만 사용하며 임의의 수치·후기·로고를 추가하지 않는다.
- Hallmark 정적·렌더 검사를 실행하고 FAIL을 모두 해결한다.

## 작업 순서

1. `AGENTS.md`의 `Hallmark 스킬 사용 제한`을 지키고, 시작 전 추적 파일의 변경이 없는지 확인한다.
2. 개발 서버를 켠 상태에서 `sloplint --render --before --url <route> --scope app`으로 기준을 새로 기록한다. 기존 `.hallmark/before.json`은 재사용하지 않는다.
3. 시스템(토큰, 폰트, `design.md`, `AppLayout`)을 먼저 만든다.
4. 노트, 퀴즈, 오답노트, 대시보드, 마이페이지, 게시판, 로그인 순서로 진행한다.
5. 화면별 상태와 상호작용을 Emil 원칙에 맞춰 정리한다.
6. 단계마다 검증 후 커밋 가능한 단위로 나눈다.
7. 최종적으로 전체 화면의 디자인 일관성, 기능 보존, 반응형, 접근성을 검토한다.

## 수정 후보 파일

- `frontend/src/index.css`
- `frontend/src/components/layout/AppLayout.jsx`
- `frontend/src/pages/DashboardPage.jsx`
- `frontend/src/pages/DashboardPage.css`
- `frontend/src/pages/CourseDetailPage.jsx`
- `frontend/src/components/editor/NotionEditor.jsx`
- `frontend/src/components/course/NoteTreeItem.jsx`
- `frontend/src/components/course/CourseBoardPanel.jsx`
- `frontend/src/components/editor/components/KeywordExplainPanel.jsx`
- `frontend/src/components/editor/components/KeywordSelectionMenu.jsx`
- `frontend/src/components/editor/components/BlockHandle.jsx`
- `frontend/src/components/editor/components/SuggestionList.jsx`
- `frontend/src/components/editor/components/CBTPlayer.jsx`
- `frontend/src/components/editor/components/QuizConfigModal.jsx`
- `frontend/src/components/editor/components/QuizAttemptsModal.jsx`
- `frontend/src/components/editor/components/IncorrectNoteModal.jsx`
- `frontend/src/pages/QuizLibraryPage.jsx`
- `frontend/src/pages/QuizLibraryPage.css`
- `frontend/src/components/quiz/QuizListPanel.jsx`
- `frontend/src/components/quiz/QuizHistoryPanel.jsx`
- `frontend/src/components/quiz/QuestionComments.jsx`
- `frontend/src/pages/IncorrectNotesPage.jsx`
- `frontend/src/pages/IncorrectNotesPage.css`
- `frontend/src/components/quiz/IncorrectGroupsPanel.jsx`
- `frontend/src/components/quiz/TodayReviewList.jsx`
- `frontend/src/components/quiz/WeakAreaBreakdown.jsx`
- `frontend/src/components/quiz/IncorrectSummaryCards.jsx`
- `frontend/src/pages/MyPage.jsx`
- `frontend/src/pages/MyPage.css`
- `frontend/src/components/mypage/ActivityHeatmap.jsx`
- `frontend/src/pages/SharedNoteBoardPage.jsx`
- `frontend/src/pages/SharedQuizBoardPage.jsx`
- `frontend/src/pages/SharedBoard.css`
- `frontend/src/components/shared-notes/SharedNoteViewer.jsx`
- `frontend/src/context/ConfirmContext.jsx`
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/LoginPage.css`

실제 구현 시에는 변경이 필요한 파일만 선택하고, 관련 없는 파일은 수정하지 않는다.

## 검증

- Frontend lint: `cd frontend; npm run lint`
- Frontend build: `cd frontend; npm run build`
- Frontend tests: `cd frontend; npm run test`
- 테스트를 재디자인에 맞춰 고치지 않는다. `QuizConfigModal.test.jsx`는 텍스트와 역할 기반 조회가 102줄이라 그룹 재배치 영향이 크다.
- Hallmark: `sloplint --render --kept`로 링크, 필드, 핸들러, 테스트 훅 누락을 확인한다.
- 확인 폭: 320, 375, 1024, 1920px
- 변경 화면의 주요 상태 수동 검토:
  - 로그인 성공·실패·로딩
  - 사이드바 접기·펼치기와 모바일 전환
  - 노트 자동 저장·실패·재시도
  - 게시판 열기·최대화·작성·수정·삭제
  - 퀴즈 생성·풀이·제출·결과·오답노트
  - 오답노트 화면의 오늘의 복습·취약 영역·다시 풀기
  - 공유 노트 상세
  - 라이트·다크 모드
  - 키보드 focus와 reduced motion

## 보존해야 할 계약

- 기존 REST API 경로와 응답 필드
- JWT 인증과 Axios interceptor 흐름
- 노트 Tiptap JSON, 자동 저장 debounce, localStorage 복구
- 블록 ID, 페이지 링크, 첨부 파일, 출처 이동
- 퀴즈 생성·저장·풀이·오답노트 연결
- 익명 게시글·댓글의 작성자 마스킹과 권한 동작
- 기존 라우트, 폼 필드, 테스트 선택자 및 핵심 이벤트 핸들러

## 후속 작업

로직이나 데이터 변경이 필요해 이 계획에서 제외한 항목이다.

- 자동 저장 실패 원인 표시
- CBT 결과 화면에 `다시 풀기` 추가
- 작업 중 발견한, 로직이 없는 로딩·오류·빈 상태와 복구 액션
