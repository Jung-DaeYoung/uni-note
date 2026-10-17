# 키워드 설명 패널 MVP (PLANS.md 1단계)

## 문제와 목표

노트에서 단어나 짧은 문장을 선택했을 때 바로 뜻을 확인할 방법이 없다. 이번 단계는 텍스트를 선택하면 "키워드 설명" 버튼을 보여 주고, 오른쪽 패널에 AI 설명(3줄 요약·쉬운 설명·전공 심화), 연관 키워드, 관련 자료 검색 링크를 보여 준다.

노트 언급 검색, 문제 만들기 연계, 설명 삽입은 2·3단계에서 한다.

## 백엔드

1. **`GeminiClient` 분리 (동작 불변 리팩터)**
   - `QuizAiGenerationService`의 API 키, URL, `restTemplate` 호출, `extractGeneratedText`를 `service/GeminiClient`로 옮긴다.
   - `String generateJson(List<parts>, Map schema)`는 생성된 JSON 텍스트를 반환한다.
   - 퀴즈의 프롬프트, 스키마, 오류 코드, 사용자 메시지는 그대로 둔다. 연결 실패 메시지는 호출하는 쪽이 넘긴다.
   - 기존 `QuizAiGenerationServiceTest`가 그대로 통과해야 한다.
2. **`POST /api/keywords/explain`**
   - 요청 `KeywordExplainRequest`:
     - `keyword`: 필수, 1~80자
     - `context`: 선택, 2,000자 이하
     - `courseId`, `noteId`, `blockId`: 선택
   - 응답 `KeywordExplainResponse`:
     - `keyword`, `summary`, `easyExplanation`, `advancedExplanation`
     - `relatedKeywords`: 문자열 배열
     - `resources`: `[{ title, url, source, reason }]`
3. **`KeywordService`**
   - `noteId`가 있으면 `NoteService.getNote(noteId, studentNum)`로 본인 노트인지 확인한다(없으면 404, 남의 노트면 403).
   - 학생별 호출 제한: 10분에 20회, 초과하면 429. `QuizService.acquireGenerationSlot`과 같은 방식이다.
   - 프롬프트 원칙:
     - 키워드와 "학습자가 제공한 문맥"을 기준으로 설명한다.
     - 문맥에 없는 내용은 일반적인 전공 지식 범위에서만 설명하고, 단정하지 않는다.
     - 탭별 목적을 나눈다.
     - 연관 키워드는 최대 5개다.
     - 자료는 최대 3개이며 `{searchQuery, site, reason}`로 받는다. `site`는 허용 목록 키 중에서 고른다.
   - 별도 `PROMPT_VERSION`을 둔다.
   - 응답 정리:
     - 설명 3개가 비어 있으면 503 `AI_RESPONSE_INVALID`로 실패한다.
     - 설명은 각각 3,000자에서 자른다.
     - 연관 키워드는 공백·중복을 정리해 최대 5개, 각 30자 이하만 남긴다.
     - 자료는 허용 목록에 있는 `site`와 빈칸이 아닌 검색어만 최대 3개 남기고, 서버가 URL을 조립한다.
   - 로그 한 줄 `keyword.explain`(status, promptVersion, elapsedMs, studId, keywordChars, contextChars)을 남긴다. 키워드·문맥 본문은 남기지 않는다.
4. **자료 허용 목록**(서버 상수)
   - `wikipedia_ko`: `https://ko.wikipedia.org/w/index.php?search=`
   - `wikipedia_en`: `https://en.wikipedia.org/w/index.php?search=`
   - `mdn`: `https://developer.mozilla.org/ko/search?q=`
   - `scholar`: `https://scholar.google.com/scholar?q=`

## 프론트엔드

- **`KeywordSelectionMenu`** (`components/editor/components/`, `NotionEditor`에 `onKeywordSelect`를 넘길 때만 표시)
  - 선택 텍스트를 trim한다. 1~80자이고 텍스트가 있을 때만 버튼을 활성화하고, 80자를 넘으면 안내 문구를 보여 준다.
  - 위치는 `editor.view.coordsAtPos`로 계산한다. 버튼은 `onMouseDown`에서 `preventDefault`를 호출해 선택을 유지한다.
  - 넘기는 값: `{ keyword, context, blockId }`. 문맥은 선택이 속한 최상위 블록의 텍스트(최대 2,000자)이고, `blockId`는 그 블록의 `attrs.id`(없으면 null)다.
- **`KeywordExplainPanel`** (`CourseBoardPanel`과 같은 오른쪽 고정 400px 패널)
  - 헤더(키워드, 닫기), 탭 3개(`role="tablist"`), 연관 키워드 칩, 자료 링크(`target="_blank" rel="noopener noreferrer"`)로 구성한다.
  - 로딩, 오류(서버 `message`와 다시 시도), 빈 상태를 보여 준다.
  - 연관 키워드 칩을 누르면 같은 문맥으로 그 키워드를 설명한다.
- **`useKeywordExplanation`** (`hooks/`)
  - `client.post('/keywords/explain')`를 호출한다.
  - 세션 캐시를 둔다. 키는 `noteId|blockId|정규화 키워드|문맥`이다.
  - 진행 중인 같은 요청은 다시 보내지 않는다.
- **`CourseDetailPage`**
  - `keywordTarget` 상태를 둔다. 키워드를 선택하면 커뮤니티 패널을 닫는다.
  - 커뮤니티 버튼을 누르면 키워드 패널을 닫는다.
  - 노트 영역 여백은 패널이 하나라도 열려 있으면 400px로 둔다.
  - 노트가 바뀌면 패널을 닫는다.

## 제외 (다음 단계)

- 노트 언급 검색, 문제 만들기 버튼, 설명 삽입, 모바일 bottom sheet, 공유 노트 뷰어

## 검증

- **백엔드**
  - WebMvc: 키워드 81자·빈칸, 문맥 2,001자 → 400 `VALIDATION_FAILED`
  - `KeywordService` 단위 테스트:
    - 남의 노트 403
    - 호출 제한 429
    - 설명 3개가 비면 503
    - 연관 키워드·자료 정리(허용 목록 밖 site 제거, URL 인코딩, 개수 제한)
  - `GeminiClient` 분리 후 기존 퀴즈 테스트 전부 통과, `backend\gradlew.bat test`
- **프론트**
  - vitest: 선택 메뉴 활성·비활성(80자), 패널 탭 전환·로딩·오류·링크 속성, 캐시로 같은 요청 1회
  - `npm run lint`, `npm run build`, `npm run test`
- **실제 확인**
  - 로컬 서버에서 실제 Gemini로 설명 요청
  - 브라우저에서 선택 → 메뉴 → 패널 → 탭 → 연관 키워드 → 커뮤니티 패널 전환 확인
- `docs/api.md`에 키워드 API 추가
