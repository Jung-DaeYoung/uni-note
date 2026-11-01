# UniNote 통합 검색 기능 설계 및 구현 계획

## 목표

화면 상단에 전역 검색 기능을 추가한다. 사용자가 키워드를 검색하면 접근 권한이 있는 콘텐츠 중 일치하는 결과를 유형별로 보여주고, 노트 검색 결과는 가능한 경우 해당 키워드가 포함된 블록까지 바로 이동시킨다.

- 기존 인증, 권한, API 계약, 라우트와 콘텐츠 저장 형식을 유지한다.
- 검색 결과에서 학습 맥락으로 바로 이동할 수 있게 한다.
- 익명 게시판 작성자의 실명·학번을 검색하거나 노출하지 않는다.
- 검색 결과가 많아져도 헤더 검색과 전체 검색 화면을 모두 사용할 수 있게 한다.
- 1단계는 DB 스키마를 변경하지 않는다.

## 검색 대상

### 1단계 범위

| 유형 | 검색 필드 | 접근 범위 |
|---|---|---|
| 내 노트 | `Note.title`, `Note.searchContent` | 본인 노트(`studId`), 직접 만든 강의 포함 |
| 강의 게시판 | `Post.title`, `Post.content` | 수강 강의 |
| 노트 공유 | `SharedNotePost.title` | 수강 강의 |
| 문제 공유 | `QuizSet.title`, `Question.questionText` | 수강 강의의 `SharedQuiz` |

### 이후 확장 범위

이번 작업에서 구현하지 않는다.

- 공유 노트 내부 스냅샷의 제목 및 본문
- 내 퀴즈 제목 및 문제 내용
- 오답노트 문제 내용
- 문제 개념 태그·해설·댓글
- 관련도순 정렬: `LIKE` 검색에는 관련도 점수가 없다.
- 최근 검색어: 저장 방식과 보관 정책이 정해지지 않았다.
- 블록 단위 인덱스 테이블: 측정 결과 `KeywordService` 방식이 느릴 때 검토한다.

## 사용자 경험 설계

### 전역 검색 위치

`AppLayout` 상단 헤더에서 `headerContent` 영역과 테마 전환 버튼 사이에 검색창을 배치한다.

```text
[메뉴] [headerContent.................] [검색창] [테마]
```

- `AppLayout.jsx:263`의 `headerContent` 영역은 `overflow-hidden`이라 결과 패널이 잘리므로, 검색창은 이 영역의 바깥 형제 요소로 둔다.
- 넓은 헤더에서 검색창 폭은 약 14rem으로 시작한다.
- 축소 기준은 뷰포트가 아니라 헤더 폭이다. 사이드바 때문에 같은 뷰포트에서도 폭이 달라지므로 컨테이너 쿼리를 쓴다.
- 좁은 헤더에서는 검색 아이콘 버튼만 보여 주고, 누르면 헤더 위에 입력창을 펼친다. 접근 가능한 이름은 유지한다.
- 노트 화면에서 기존 액션의 축약 기준(`CourseDetailPage.css:142`, 34rem)이 지나치게 일찍 작동하지 않는지 확인한다. 1024px에서 사이드바를 펼친 상태는 검색창을 아이콘으로 줄이는 쪽을 우선한다.

검색 입력:

- `노트, 게시글, 문제 검색` placeholder
- trim 후 2글자 이상이면 250ms debounce 후 요청
- 입력 중 헤더 아래 결과 패널 표시
- `Enter` 시 항목을 선택하지 않았으면 `/search?q=키워드`로 이동
- `Escape`로 결과 패널 닫기(입력값 유지)
- `ArrowUp`, `ArrowDown`, `Enter`로 결과 선택
- 한글 조합 중(`event.isComposing`)에는 `Enter`와 화살표 키를 처리하지 않는다.
- 포커스는 입력창에 유지하고 `role="combobox"`와 `aria-activedescendant`로 선택 항목을 알린다.

### 결과 패널

검색 결과를 콘텐츠 유형별 그룹으로 보여준다.

```text
내 노트
  프로세스 스케줄링
  CPU 스케줄링의 기본 개념...
  운영체제

강의 게시판
  운영체제 과제 질문
  익명 42, 컴퓨터구조, 2시간 전

노트 공유
  운영체제 중간고사 정리

문제 공유
  프로세스와 스레드 문제 모음
```

각 항목에 포함할 정보:

- 제목
- 검색어가 포함된 미리보기(없으면 생략)
- 강의명
- 날짜
- 게시글·공유 콘텐츠의 익명 표기
- 검색어 강조

패널에서는 유형별 최대 5개를 보여주고, 마지막에 `전체 검색 결과 보기`를 제공한다. 결과가 없는 유형의 그룹은 표시하지 않는다.

### 검색 전용 화면

경로:

```text
/search?q=검색어&type=all&courseId=1
```

구성:

- 검색어 입력창
- 유형 필터: 전체, 내 노트, 강의 게시판, 노트 공유, 문제 공유
- 강의 필터: `CourseContext`의 강의 목록(`/dashboard/courses`)을 재사용한다. 이 목록에는 수강 강의와 직접 만든 강의가 모두 들어 있다(`DashboardService.java:40-43`).
- 최신순 결과 목록
- `전체`는 유형별 그룹과 `더 보기`(해당 유형 필터로 전환)
- 특정 유형은 `더 보기`로 다음 페이지 추가

## 검색 결과 이동

### 노트

`CourseDetailPage.jsx:111`의 언급 이동과 같은 방식을 쓴다.

```js
navigate(`/course/${courseId}/note/${noteId}`, blockId ? { state: { sourceBlockId: blockId } } : undefined);
```

- `useSourceBlockScroll.js`가 `location.state.sourceBlockId`로 스크롤·강조(3초)와 실패 알림을 처리하므로 수정하지 않는다.
- `?blockId=` query parameter는 추가하지 않는다.
- `blockId`가 null이면 노트만 연다.

### 게시판 및 공유 콘텐츠

| 유형 | 이동 경로 | 상태 |
|---|---|---|
| 강의 게시판 | `/course/{courseId}?postId={postId}` | 기존 `useCourseBoard.js:45-58` 사용 |
| 노트 공유 | `/shared-notes/{sharedNotePostId}` | 기존 라우트 사용 |
| 문제 공유 | `/shared-quizzes?sharedQuizId={sharedQuizId}` | 새로 추가 |

문제 공유 딥링크:

- 상세 라우트는 추가하지 않는다.
- `SharedQuizBoardPage`/`useSharedQuizzes`에서 목록 로딩 후 해당 글을 찾아 기존 `openQuiz(post)`로 연다. 조회수는 목록에서 클릭할 때와 같이 1 오른다.
- 연 뒤 query parameter를 `replace`로 지워, 닫은 후나 목록 재조회 시 다시 열리지 않게 한다.
- 대상 글이 없으면(내려간 글 등) 기존 알림 방식으로 안내하고 목록을 유지한다.

## API 설계

### 통합 검색 API

```http
GET /api/search?q=운영체제&type=all&courseId=1&page=0&size=20
```

요청 규칙:

- `q`: 필수, trim 후 2~100자. 위반 시 400 `INVALID_REQUEST`
- `type`: `all`(기본), `note`, `post`, `shared_note`, `shared_quiz`. 그 외 400
- `courseId`: 선택. 수강 또는 소유 강의가 아니면 기존 `CourseAccessException`
- `page`: 기본값 0. `type=all`에서는 무시
- `size`: 기본값 20, 최대 50. `type=all`에서는 무시하고 유형별 최대 5개

응답 예시:

```json
{
  "query": "운영체제",
  "groups": [
    {
      "type": "NOTE",
      "hasMore": true,
      "results": [
        {
          "type": "NOTE",
          "targetId": 12,
          "blockId": "c1f0a2",
          "title": "프로세스 스케줄링",
          "preview": "운영체제에서 프로세스는 ...",
          "courseId": 1,
          "courseName": "운영체제",
          "authorName": null,
          "date": "2026-11-01T12:30:00"
        }
      ]
    }
  ]
}
```

- 결과 타입: `NOTE`, `COURSE_POST`, `SHARED_NOTE`, `SHARED_QUIZ`
- `targetId`: 유형별 원본 ID(`noteId`, `postId`, `sharedNotePostId`, `sharedQuizId`)
- `blockId`, `preview`, `authorName`은 null일 수 있다.
- `date`: 노트는 `updatedAt`, 나머지는 `createdAt`
- 화면 경로는 서버가 내려주지 않고 `searchUtils`에서 만든다.
- 여러 테이블을 합쳐 페이지 처리하지 않으므로 전체 건수를 응답하지 않는다. `hasMore`는 `size + 1`개를 조회해 판단한다.
- 내부 엔티티를 노출하지 않고 공통 DTO로 변환한다.

## 백엔드 구조

```text
SearchController
  -> SearchService
      -> NoteRepository
      -> PostRepository
      -> SharedNotePostRepository
      -> SharedQuizRepository
```

추가·수정 파일:

- `backend/src/main/java/com/uninote/backend/controller/SearchController.java`
- `backend/src/main/java/com/uninote/backend/service/SearchService.java`
- `backend/src/main/java/com/uninote/backend/dto/SearchResponse.java`
- `backend/src/main/java/com/uninote/backend/dto/SearchResultResponse.java`
- 각 대상 Repository의 검색 메서드
- `KeywordService`의 블록 탐색 공통 부분을 함께 쓸 수 있게 정리

### 검색 방식

- 소문자 변환 후 `KeywordService.java:138`과 같이 `!`, `%`, `_`를 이스케이프하고 `LIKE ... ESCAPE '!'`를 쓴다.
- 모든 쿼리는 최신순이며 `Pageable`로 제한하고, 강의명 N+1이 생기지 않게 조회한다.
- 수강 강의가 없으면 `IN` 쿼리를 실행하지 않는다.

### 노트 결과

- 제목 또는 `searchContent` 일치 노트를 찾고, 노트당 결과 1개를 만든다.
- `KeywordService.java:140-158`처럼 본문 JSON의 최상위 블록에서 첫 일치 블록의 `blockId`와 미리보기를 만든다.
- 다음 경우에도 결과에서 제외하지 않고 `blockId` null로 돌려준다(`PLANS.md:180`의 누락 방지).
  - 제목만 일치한 노트
  - `blockId`가 없는 옛 블록
  - `searchContent`와 본문이 어긋난 노트
  - 본문 JSON을 해석하지 못한 노트(경고 로그를 남긴다)

### 문제 공유 결과

- 쿼리는 `SharedQuiz`에서 시작해 수강 강의로 제한한다. `Question`을 직접 검색하지 않아 비공개 퀴즈 문항이 노출되지 않게 한다.
- 시험당 결과 1개로 중복을 제거하고, 미리보기는 첫 일치 문항의 `questionText`로 만든다.
- `correctAnswer`, `options`, `explanation`, `conceptTags`는 검색하거나 응답하지 않는다.

## 권한과 개인정보 보호

검색 결과는 반드시 Service 계층에서 로그인한 사용자 기준으로 제한한다.

- 내 노트: 본인이 작성한 노트만
- 강의 게시판, 노트 공유, 문제 공유: 수강 강의만
- `courseId`: `NoteService.java:134-135`와 같이 수강 또는 소유를 허용한다.
- 직접 만든 강의를 필터로 고르면 노트 결과만 돌려주고, 게시판·공유 유형은 오류 없이 빈 결과로 둔다. `client.js:43-45`가 403 `FORBIDDEN_COURSE_ACCESS`를 알림 후 대시보드 이동으로 처리하기 때문이다.
- 작성자 표기는 `PostService.anonymousName`을 재사용하고, 학번·실명을 응답에 넣지 않는다.

화면에서 숨기는 방식으로 권한을 처리하지 않는다. 검색 쿼리와 결과 변환 단계 모두에서 접근 범위를 제한한다.

## 프론트엔드 구조

```text
frontend/src/
├─ components/search/
│  ├─ GlobalSearch.jsx
│  ├─ GlobalSearch.css
│  ├─ SearchResultItem.jsx
│  └─ searchUtils.js
├─ pages/
│  ├─ SearchPage.jsx
│  └─ SearchPage.css
└─ hooks/
   └─ useGlobalSearch.js
```

역할:

- `GlobalSearch`: 헤더 검색 입력, 결과 패널, 키보드 조작
- `SearchResultItem`: 제목·미리보기·메타·검색어 강조
- `useGlobalSearch`: debounce, 요청 취소, loading/error 상태
- `SearchPage`: 전체 결과, 필터, 더 보기
- `searchUtils`: 타입별 라벨과 이동 대상

요청은 `src/api/client.js`를 직접 사용하며, 기존 훅과 같이 `AbortController`로 이전 요청을 취소한다.

`App.jsx`의 `ProtectedRoute` 안에 `/search`를 추가한다.

## 디자인 방향

- `.lib-btn`과 `--lib-*` 토큰을 재사용하고 기존 구분선 목록 스타일을 따른다. 헤더에는 `.lib` 클래스를 붙이지 않는다(`html:has(.lib)` 규칙이 작동한다).
- 유형은 글자 라벨로만 구분하고 유형별 아이콘을 쓰지 않는다. 아이콘은 좁은 헤더의 검색 버튼에만 쓴다.
- 메타 정보를 가운뎃점으로 잇지 않는다.
- 검색창은 얇은 테두리와 명확한 focus 표시를 사용한다.
- 결과는 카드 중첩 없이 구분선 목록으로 표현한다.
- 검색어 강조는 HTML 삽입 없이 문자열을 나눠 `<mark>`로 렌더링하고 단일 accent 색상을 쓴다.
- 결과 패널은 불투명 배경으로 하고 최대 높이를 제한해 내부 스크롤을 사용한다.
- 로딩 중 헤더 높이가 흔들리지 않게 한다.
- 빈 결과 문구:

```text
검색 결과가 없습니다.
노트 제목, 본문, 게시글 또는 문제 키워드를 바꿔 검색해 보세요.
```

- `:focus-visible`, `Escape`, reduced motion을 지원한다.
- 외부 폰트·스타일시트를 추가하지 않고 CSP를 변경하지 않는다.

## 상태 설계

| 상태 | 동작 |
|---|---|
| 빈 입력 | 패널을 열지 않음 |
| 1자 입력 | 요청하지 않고 최소 검색어 안내 |
| 검색 중 | 입력은 유지하고 결과 영역에 loading 표시 |
| 결과 있음 | 유형별 결과와 전체 결과 링크 표시 |
| 결과 없음 | 빈 결과 문구 표시 |
| 요청 실패 | 오류 메시지와 재시도 제공 |
| Escape | 패널 닫기, 입력값은 유지 |
| 결과 선택 | 대상 화면으로 이동하고 패널 닫기 |

## 구현 순서

1. 기존 디자인 변경을 먼저 커밋해 `AppLayout`, `CourseDetailPage` 변경이 섞이지 않게 하고, `git status --short`로 확인한다.
2. Repository 검색 쿼리와 공통 DTO를 작성한다.
3. `KeywordService`의 블록 탐색을 재사용 가능하게 정리한다. 기존 언급 검색 동작은 바꾸지 않는다.
4. `SearchService`에서 권한 검증, 결과 변환, 유형별 제한과 페이지 처리를 구현한다.
5. `SearchController`와 백엔드 테스트를 추가한다.
6. `useGlobalSearch`, `GlobalSearch`, `searchUtils`를 구현하고 `AppLayout`에 연결한다.
7. `/search` 화면과 필터를 구현한다.
8. 문제 공유 딥링크를 추가한다.
9. 로딩·빈 결과·오류·키보드·좁은 헤더 상태를 정리한다.
10. `docs/api.md`에 API를 반영하고 전체 검증을 실행한다.

## 검증

### 백엔드

- `backend\gradlew.bat test`
- 검색어 trim·길이·`%`·`_`·`!` 처리, 잘못된 `type`
- 다른 학생의 노트가 검색되지 않음
- 수강하지 않은 강의의 게시글·공유 글이 검색되지 않음
- 공유되지 않은 퀴즈의 문항이 검색되지 않음
- 정답·해설로는 공유 문제가 검색되지 않음
- 직접 만든 강의 `courseId` 필터가 403 없이 노트 결과를 돌려줌
- 수강·소유하지 않은 `courseId`는 거부됨
- 제목만 일치, 옛 블록, 깨진 본문 노트가 `blockId` null로 결과에 포함됨
- 응답에 학번·실명이 없음
- 유형별 5개 제한과 `hasMore`

### 프론트엔드

- `npm run lint --prefix frontend`
- `npm run build --prefix frontend`
- `npm run test --prefix frontend`
- debounce와 이전 요청 취소
- 한글 조합 중 `Enter`·화살표 키 무시
- `Enter`·`Escape`·화살표 키 조작과 `aria-activedescendant`
- 검색어에 HTML이 있어도 문자열로 렌더링됨
- 노트 블록 이동·강조, 블록 없는 노트 열기
- 게시글·공유 노트·공유 문제 이동, 닫은 뒤 공유 문제가 다시 열리지 않음
- 라이트·다크 모드
- 320px, 375px, 768px, 1024px, 1440px 헤더 배치(320px·375px는 사이드바 접은 상태, 1024px는 펼친 상태 포함)
- 노트 화면의 저장 상태·액션 버튼이 잘리지 않음
- reduced motion

## 완료 기준

- 모든 인증된 화면의 상단에서 검색을 시작할 수 있다.
- 1단계 검색 대상 4종의 결과가 유형별로 표시된다.
- 노트 결과를 클릭하면 해당 노트로 이동하고, 일치 블록을 찾은 경우 그 블록으로 스크롤·강조한다.
- 게시판 및 공유 콘텐츠 결과가 해당 글·시험을 연다.
- 검색 결과가 사용자의 접근 권한을 벗어나지 않는다.
- 익명 작성자의 실명·학번이 검색 응답에 포함되지 않는다.
- 결과 있음·없음·로딩·오류·키보드·좁은 헤더 상태가 구현된다.
- 기존 노트 편집, 게시판, 퀴즈, 인증 흐름이 변경되지 않는다.
