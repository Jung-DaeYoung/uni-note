# UniNote 프론트엔드 UI 스타일 개선 계획

## 목표

frontend 전반의 반복적인 카드·강한 색상·과도한 둥근 모서리·굵은 글꼴·장식성 애니메이션을 줄이고, 노트와 학습 관리 서비스에 어울리는 차분하고 세련된 UI로 개선한다.

전체 방향은 **Notion·Linear 스타일을 기본으로 하되, 오답 통계 화면에는 데이터 중심 학습 관리 SaaS 스타일을 결합**한다.

```text
전체 서비스: Notion·Linear 스타일
대시보드: 카드 수를 줄인 문서형 레이아웃
생성 문제 모음: 얇은 border 중심의 리스트/카드
오답 통계: 수치와 progress bar 중심
오답노트 모음: 단순한 폴더 목록
강의·노트 화면: 기존 구조 유지 + 메뉴와 버튼 절제
```

## 현재 스타일의 주요 문제

현재 frontend는 Tailwind 유틸리티를 조합하는 방식으로 구현되어 있으나 다음 패턴이 여러 화면에 반복된다.

- `rounded-2xl`, `rounded-3xl`이 카드·버튼·빈 상태 영역에 과도하게 사용됨
- `font-black`, `uppercase`, `tracking-widest`가 제목과 보조 라벨에 반복됨
- 파랑·하늘색·보라색·초록색이 화면별로 분산되어 시각적 체계가 약함
- 기본 카드에 `shadow-sm`, hover 시 `shadow-md`·`shadow-xl`이 반복됨
- `hover:scale`, `translate` 등 장식성 애니메이션이 여러 컴포넌트에 적용됨
- 모든 콘텐츠가 흰색 카드로 분리되어 정보 계층보다 카드 모음처럼 보임
- 대시보드·퀴즈·오답 화면의 카드와 섹션 패턴이 지나치게 유사함

## 디자인 원칙

### 1. 정보 계층 우선

그림자와 색상보다 제목 크기, 글꼴 두께, 여백, 구분선으로 중요도를 표현한다.

- 페이지 제목: `font-bold`
- 섹션 제목: `font-semibold`
- 카드 제목: `font-semibold`
- 본문: `font-normal` 또는 `font-medium`
- 보조 정보: `font-normal`, muted text

`font-black`은 로고나 매우 제한적인 숫자 강조에만 사용한다.

### 2. 모서리 반경 단순화

```text
페이지·큰 영역: rounded-xl
카드: rounded-lg
버튼: rounded-md 또는 rounded-lg
상태 배지: rounded-md
아이콘·아바타: rounded-full
```

`rounded-3xl`은 특별한 빈 상태나 대형 모달이 아니면 사용하지 않는다.

### 3. 그림자 최소화

```text
일반 카드: shadow-none + border
강조 카드: shadow-sm
모달·팝오버: shadow-xl
hover: shadow보다 border/background 변화 우선
```

카드 hover는 `hover:shadow-md`보다 `hover:border-slate-300` 또는 배경색 변화로 처리한다.

### 4. 색상 역할 통일

페이지마다 다른 강조색을 배정하지 않고 의미별 색상만 사용한다.

```text
파랑: 주요 액션·링크
초록: 성공·복습 가능 상태
주황: 반복 오답·주의
빨강: 삭제·오류
회색: 일반 정보·보조 텍스트
```

`purple`과 `sky`는 별도의 의미가 명확할 때만 사용한다. 단순히 화면을 화려하게 만들기 위한 색상 분산은 제거한다.

### 5. 장식용 타이포그래피 제거

다음 조합은 필요한 경우에만 제한적으로 사용한다.

```jsx
uppercase tracking-widest
font-black
text-[10px]
```

일반 보조 라벨은 다음 기준을 우선한다.

```jsx
text-xs font-medium text-slate-500
```

`Learning Hub Overview`와 같은 장식용 영문 문구는 제거하거나 의미 있는 한글 설명으로 대체한다.

### 6. 애니메이션 절제

```text
버튼: transition-colors
리스트 행: background 색상 변화
카드: border 색상 변화
아이콘: 확대하지 않음
모달·페이지 전환: 실제 상태 변화가 있는 곳만 transition
```

`hover:scale-105`, `group-hover:translate-x-*`, 반복적인 `active:scale-*`, `hover:shadow-xl`은 우선 제거 대상이다.

## 화면별 개선 방향

### 공통 레이아웃

대상:

- `frontend/src/components/layout/AppLayout.jsx`
- `frontend/src/index.css`

변경 방향:

- 사이드바의 강한 `bg-slate-900` 대비를 완화하고 메뉴 간 간격과 활성 상태를 정돈한다.
- 메뉴의 `rounded-xl`을 `rounded-lg` 또는 `rounded-md`로 줄인다.
- 활성 메뉴는 밝은 배경과 강한 대비 대신 얇은 왼쪽 border 또는 낮은 채도의 배경으로 표현한다.
- 로고의 강한 blue shadow를 제거하거나 약화한다.
- 헤더의 반투명 backdrop blur를 줄이고 명확한 border 중심으로 정리한다.
- 공통 CSS 변수와 Tailwind 색상 사용 기준을 일치시킨다.

### 대시보드

대상:

- `frontend/src/pages/DashboardPage.jsx`

변경 방향:

- 최근 노트는 3열 카드 중심 구조에서 리스트 또는 낮은 높이의 2열 구조로 완화한다.
- 커뮤니티 게시글은 카드 그리드보다 행 기반 목록에 가깝게 구성한다.
- 섹션 제목의 `uppercase tracking-widest`를 제거한다.
- 강의 카드의 아이콘 박스와 hover scale을 축소한다.
- `rounded-2xl`, `rounded-3xl`, `shadow-xl` 사용을 줄인다.
- 섹션 간 여백은 유지하되 카드 내부 장식보다 텍스트 정렬과 구분선을 강조한다.

### 생성 문제 모음

대상:

- `frontend/src/pages/QuizLibraryPage.jsx`
- `frontend/src/components/quiz/QuizListPanel.jsx`
- `frontend/src/components/quiz/QuizHistoryPanel.jsx`

변경 방향:

- 카드의 그림자를 제거하고 얇은 border를 기본으로 사용한다.
- 강의명·난이도 배지를 작고 차분하게 만든다.
- `font-black`을 `font-semibold` 또는 `font-medium`으로 완화한다.
- `다시 풀기`, `결과 확인` 버튼의 pill 느낌을 줄이고 명확한 primary/secondary 버튼으로 구분한다.
- 풀이 기록은 카드보다 날짜·점수·퀴즈명 정렬이 잘 보이는 리스트형 UI를 우선 검토한다.

### 오답 통계

대상:

- `frontend/src/components/quiz/IncorrectSummaryCards.jsx`
- `frontend/src/components/quiz/TodayReviewList.jsx`
- `frontend/src/components/quiz/WeakAreaBreakdown.jsx`
- 오답 통계 페이지 조합 컴포넌트

변경 방향:

- 4개의 통계 카드를 과도한 아이콘 배경 없이 수치와 라벨 중심으로 정리한다.
- 통계 카드의 아이콘 박스 크기와 색상 대비를 줄인다.
- 취약 강의·유형은 progress bar 색상보다 수치·항목 정렬을 우선한다.
- 오늘의 복습은 목록 행을 중심으로 구성하고 원문 보기·다시 풀기 액션을 보조 버튼으로 배치한다.
- 통계 데이터가 많아질 경우 카드 추가보다 표·행·구분선으로 확장한다.

### 오답노트 모음

대상:

- `frontend/src/components/quiz/IncorrectGroupsPanel.jsx`

변경 방향:

- 폴더 카드의 큰 아이콘 영역을 축소한다.
- 그룹명·문항 수·마지막 액션의 계층을 명확히 한다.
- 삭제와 다시 풀기 버튼을 과도한 색상이나 그림자로 강조하지 않는다.
- 그룹이 많을 때를 고려해 카드 그리드와 리스트 중 적합한 형태를 검토한다.

### 강의·노트 화면

대상:

- `frontend/src/pages/CourseDetailPage.jsx`
- `frontend/src/components/course/NoteTreeItem.jsx`
- `frontend/src/components/course/CourseBoardPanel.jsx`

변경 방향:

- 노트 편집 영역과 사이드바의 기존 기능 구조는 유지한다.
- 메뉴·버튼의 radius와 강조색만 공통 기준에 맞춘다.
- 노트 트리의 선택 상태는 강한 배경색보다 텍스트 색상·왼쪽 표시선으로 표현한다.
- 커뮤니티 패널의 카드와 버튼을 전체 디자인 토큰에 맞춰 정리한다.

## 공통 스타일 토큰 계획

`frontend/src/index.css`의 기존 변수와 실제 Tailwind 사용 패턴을 정리한다.

권장 기본 토큰:

```css
:root {
  --primary-color: #2563eb;
  --primary-muted: #eff6ff;
  --bg-color: #f8fafc;
  --surface-color: #ffffff;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --border-color: #e2e8f0;
  --success-color: #15803d;
  --warning-color: #b45309;
  --danger-color: #b91c1c;
}
```

새로운 UI를 추가할 때 임의의 색상·반경·그림자를 추가하지 않고 이 역할 체계를 따른다.

## 구현 순서

1. `index.css`와 공통 레이아웃의 색상·border·radius 기준을 정리한다.
2. `AppLayout.jsx`의 사이드바·헤더 활성 상태와 장식 효과를 개선한다.
3. `DashboardPage.jsx`에서 카드 반복과 장식용 타이포그래피를 줄인다.
4. 생성 문제 모음과 풀이 기록의 카드·버튼 스타일을 통일한다.
5. 오답 통계 카드·복습 목록·취약 영역의 정보 밀도를 개선한다.
6. 오답노트 모음의 폴더 카드 스타일을 공통 기준에 맞춘다.
7. 강의·노트 화면은 기능을 유지하면서 메뉴·버튼 스타일만 정리한다.
8. 공통 스타일이 새 화면에도 적용되는지 확인하고 중복 클래스를 제거한다.

## 변경 우선순위

### 1순위: 시각적 효과가 큰 저위험 변경

- `font-black` 완화
- `uppercase tracking-widest` 제거
- `rounded-2xl`, `rounded-3xl` 축소
- 반복 shadow 제거
- 색상 역할 통일

### 2순위: 화면 구조 개선

- 대시보드 최근 노트의 카드 그리드 완화
- 커뮤니티 게시글의 행 기반 표현 검토
- 풀이 기록과 오늘의 복습 목록 정렬 개선
- 오답 통계 수치 중심 레이아웃 적용

### 3순위: 공통 컴포넌트화

- 반복되는 카드 클래스 추출 여부 검토
- primary/secondary 버튼 스타일 통일
- 상태 배지와 progress bar 스타일 통일
- 공통 빈 상태·로딩 상태 스타일 통일

불필요한 디자인 시스템 추상화는 피하고, 반복이 실제로 확인되는 경우에만 공통 컴포넌트나 CSS 클래스를 추가한다.

## 호환성 원칙

- React 컴포넌트 구조와 기존 사용자 흐름은 유지한다.
- 라우팅, API 계약, 인증, 저장 동작은 변경하지 않는다.
- 다크 모드에서도 동일한 정보 계층과 대비를 유지한다.
- CSS 개선으로 기능 버튼의 위치·접근성·클릭 영역을 축소하지 않는다.
- 반응형 레이아웃과 모바일 화면의 가독성을 유지한다.
- 기존 사용자 변경 사항이 있는 파일은 내용을 확인한 뒤 통합하며 무단으로 되돌리지 않는다.

## 검증 계획

코드 변경 후 frontend 기준으로 다음을 실행한다.

```powershell
cd frontend
npm run lint
npm run build
npm run test -- --run
```

브라우저 확인 항목:

1. 대시보드의 카드·리스트 계층과 반응형 배치
2. 생성 문제 모음의 버튼·배지·빈 상태
3. 오답 통계의 수치·progress bar·오늘의 복습 목록
4. 오답노트 모음의 그룹 목록·삭제·재풀이
5. 강의 상세의 노트 트리·에디터·커뮤니티 패널
6. 라이트/다크 모드 대비와 hover/focus 상태
7. 모바일 폭에서 텍스트 잘림과 버튼 클릭 영역

## 완료 기준

- 공통 화면에서 `font-black`, `uppercase`, `tracking-widest`, 과도한 `rounded-2xl/3xl`, 반복 `shadow` 사용이 의미 있는 수준으로 감소한다.
- primary·success·warning·danger 색상의 역할이 일관된다.
- 대시보드가 단순 카드 모음이 아니라 노트·학습 정보 중심으로 보인다.
- 퀴즈·오답 화면에서 데이터 정렬과 텍스트 계층이 시각적 장식보다 우선한다.
- 라이트/다크 모드와 반응형 동작이 유지된다.
- `npm run lint`, `npm run build`, `npm run test -- --run`이 통과한다.
