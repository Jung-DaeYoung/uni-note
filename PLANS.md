# 키워드 학습 패널 구현 계획

## 1. 목표

노트에서 사용자가 단어나 짧은 문장을 선택하면 에디터 주변에 학습 패널을 열어 AI 설명, 관련 자료, 연관 키워드, 현재 노트 언급 위치를 제공한다. 선택한 키워드는 현재 노트에 설명으로 삽입하거나 기존 CBT 문제 생성 흐름으로 연결한다.

기존 노트 저장 형식, Tiptap 자동 저장, JWT 인증, `/api/quiz/generate` 검증·호출 제한·출처 연결, `CBTPlayer` 흐름은 유지한다. 새 기능은 키워드 설명 API를 별도로 추가하고, 문제 생성은 기존 퀴즈 파이프라인을 재사용한다.

## 2. 확정 범위

### MVP 포함

- 에디터에서 텍스트 드래그 선택
- 선택 영역 근처의 키워드 액션 메뉴
- 키워드 설명 패널
- 설명 탭 3개
  - 3줄 요약
  - 쉬운 설명
  - 전공 심화
- 연관 키워드
- 관련 자료 검색 링크(서버가 허용 도메인의 검색 URL을 조립)
- 현재 강의의 내 노트에서 같은 키워드가 언급된 위치
- 기존 CBT 문제 생성으로 연결
- 로딩·오류·빈 상태 및 요청 중복 방지

### 1차 이후 포함

- AI 설명을 현재 노트에 삽입
- 삽입된 설명의 자동 저장
- 언급 위치 클릭 후 해당 노트·블록으로 이동
- 설명 결과 캐시·저장
- ~~키워드별 복습·오답 통계~~ → 하지 않는다. 키워드에서 만든 문제는 키워드가 집중 개념·개념 태그로 집계되므로 오답노트의 "취약 개념" 카드(개념별 정답률, P2-3)로 대신한다.
- 모바일 bottom sheet(현재 노트 화면은 고정 폭 오른쪽 패널 구조만 있다)

### 제외

- 외부 검색 API
- 임베딩·RAG
- 키워드 관계 그래프
- 모든 설명 결과의 영구 저장
- 새 Tiptap 전용 노드 도입
- 기존 퀴즈 생성 로직의 별도 복제

## 3. 사용자 흐름

```text
노트에서 텍스트 선택
  ↓
선택 영역 근처에 [키워드 설명] [문제 만들기] 표시
  ↓
키워드 설명 선택
  ↓
오른쪽 학습 패널 표시
  ↓
설명·관련 자료·연관 키워드·노트 언급 렌더링
  ↓
필요하면 기존 CBT 생성 또는 설명 삽입
```

### 화면 정책

- 키워드 패널은 `CourseDetailPage`의 노트 영역 오른쪽에 커뮤니티 패널(`CourseBoardPanel`)과 같은 방식으로 표시한다.
- 커뮤니티 패널과 동시에 열지 않는다. 키워드 패널을 열면 커뮤니티 패널을 닫는다.
- 선택 메뉴는 편집 중인 노트(`NotionEditor`)에서만 제공한다. 공유 노트 뷰어(`SharedNoteViewer`)는 제외한다.
- 선택 영역이 사라져도 패널은 유지한다.
- 다른 텍스트를 선택하면 선택 키워드와 문맥을 갱신한다.
- 패널을 닫으면 선택 메뉴와 관련 상태를 초기화한다.

## 4. 선택·입력 정책

- 선택 텍스트는 앞뒤 공백을 제거한다.
- 최대 80자까지 허용한다.
- 공백만 선택하거나 이미지·PDF·페이지 링크만 선택한 경우 비활성화한다.
- 선택한 텍스트 주변의 현재 블록 문맥을 최대 2,000자까지 함께 전송한다.
- 노트 전체 본문은 키워드 설명 API에 보내지 않는다.
- 요청에는 현재 `courseId`, `noteId`, `blockId`를 포함한다.
- 선택된 블록에 ID가 없으면 `blockId`는 null로 보내되 설명 기능은 허용한다.
- 서버는 `noteId`가 있으면 요청 학생의 노트인지 Service 계층에서 확인한다. `courseId`·`blockId`는 1단계에서 로그·캐시 키 용도로만 쓴다.
- `context`는 클라이언트가 보낸 값이므로 프롬프트에 "학습자가 제공한 문맥"으로 넣고, 문제 생성에는 쓰지 않는다.
- AI가 문맥에 없는 사실을 단정하지 않도록 프롬프트에 명시한다.

예시 요청:

```json
{
  "keyword": "JWT",
  "context": "JWT는 인증 필터에서 검증한 뒤 SecurityContext에 저장된다.",
  "courseId": 1,
  "noteId": 10,
  "blockId": "block-42"
}
```

## 5. 백엔드 API

### 5.1 키워드 설명

```http
POST /api/keywords/explain
```

요청 DTO:

- `keyword`: 1~80자, 필수
- `context`: 최대 2,000자, 선택
- `courseId`: 선택
- `noteId`: 선택
- `blockId`: 선택

응답:

```json
{
  "keyword": "JWT",
  "summary": "JWT는 JSON 형식의 인증 정보를 담은 토큰이다.",
  "easyExplanation": "로그인한 사용자인지 확인하기 위해 서버가 발급하는 출입증이다.",
  "advancedExplanation": "Header, Payload, Signature로 구성되며 서버는 서명을 검증해 토큰 변조 여부를 확인한다.",
  "relatedKeywords": ["OAuth 2.0", "Bearer Token", "HMAC", "Refresh Token"],
  "resources": [
    {
      "title": "위키백과에서 JWT 찾기",
      "url": "https://ko.wikipedia.org/w/index.php?search=JSON+Web+Token",
      "source": "ko.wikipedia.org",
      "reason": "JWT의 구조와 표준을 정리한 문서를 찾을 수 있다."
    }
  ]
}
```

관련 자료 규칙:

- 외부 검색 API가 없으므로 AI가 만든 URL은 실제로 있는 페이지인지 확인할 수 없다. AI에게 URL을 받지 않는다.
- AI는 자료마다 `searchQuery`, `site`(허용 목록의 키), `reason`만 반환한다.
- 서버가 허용 목록의 검색 URL 템플릿에 `searchQuery`를 URL 인코딩해 넣어 `url`을 만든다. 허용 목록에 없는 `site`는 버린다.
- 초기 허용 목록 예시: 한국어 위키백과, 영어 위키백과, MDN, Google Scholar. 목록은 서버 상수로 둔다.

### 5.2 노트 언급 검색

```http
GET /api/keywords/mentions?keyword=JWT&courseId=1
```

규칙:

- 인증된 학생의 노트 중 현재 강의(`courseId`)의 노트만 검색한다.
- 후보 노트는 `Note.searchContent`(자동 저장 시 함께 저장되는 평문)로 고른다. 평문에는 블록 구분이 없으므로, `blockId`와 미리보기는 후보 노트의 `content`(Tiptap JSON)에서 키워드가 든 블록을 찾아 만든다.
- `searchContent`가 비어 있는 옛 노트는 검색되지 않는다.
- 최대 10개 결과만 반환한다.
- 원문 전체가 아니라 제목·미리보기·노트 ID·블록 ID만 반환한다.
- 검색 결과는 키워드 설명 AI 응답이 아니라 서버 검색 결과다.

응답:

```json
[
  {
    "noteId": 10,
    "noteTitle": "02_스프링보안_설정",
    "blockId": "block-42",
    "preview": "... JWT는 인증 필터에서 검증된다 ..."
  }
]
```

### 5.3 CBT 문제 생성

별도 `/api/keywords/quiz` API는 만들지 않고, 요청 필드도 추가하지 않는다. 기존 `POST /api/quiz/generate`의 필드만으로 표현한다.

```json
{
  "noteIds": [10],
  "blockSelections": [{ "noteId": 10, "blockIds": ["block-42"] }],
  "focusConcepts": ["JWT"],
  "typeCounts": { "MULTIPLE_CHOICE": 3 },
  "difficulty": "NORMAL"
}
```

- 범위는 선택한 블록(`blockSelections`, P1-5)이고, 블록 ID가 없으면 노트 전체다.
- 키워드는 `focusConcepts`(P2-4)로 넘긴다. 키워드는 30자 이하일 때만 넣는다(`focusConcepts` 항목 상한).
- 클라이언트가 보낸 문맥 문자열은 문제 생성 프롬프트에 넣지 않는다. 문제의 근거는 저장된 노트 본문뿐이다.
- 프론트는 `QuizConfigModal`을 위 범위·개념이 채워진 상태로 연다.

기존 기능의 다음 처리를 그대로 적용한다.

- 입력 노트·블록 권한 검증
- `QuizQualityValidator`
- 출처 검증
- AI 호출 제한
- 중복 문항 검사
- 퀴즈 저장
- `CBTPlayer` 연결
- 풀이·오답노트 통계 연계

## 6. AI 설명 처리

### 프롬프트 원칙

- 선택 키워드와 주변 문맥 중심으로 설명한다.
- 문맥에 없는 내용은 일반 표준 지식인지 구분한다.
- 설명 탭별 목적을 분리한다.
- 연관 키워드는 최대 5개다.
- 추천 자료는 최대 3개이며 URL 대신 검색어·허용 사이트 키·이유만 반환한다.
- 마크다운이 아닌 고정 JSON만 반환한다.

### Gemini 호출 재사용

- Gemini 호출과 응답 텍스트 추출은 현재 `QuizAiGenerationService` 안에 있다. 이 부분만 공통 컴포넌트(`GeminiClient`)로 옮겨 퀴즈와 키워드 설명이 함께 쓴다.
- 퀴즈 프롬프트·스키마·오류 코드는 바꾸지 않는다. 기존 `QuizAiGenerationServiceTest`로 회귀를 확인한다.
- 키워드 설명은 별도 `PROMPT_VERSION`과 구조화 로그 한 줄(`keyword.explain`)을 남긴다. 본문·문맥은 로그에 남기지 않는다.
- AI 호출 실패·응답 형식 오류는 기존 `ExternalServiceException`(503, `EXTERNAL_SERVICE_ERROR`/`AI_RESPONSE_INVALID`)을 쓴다.

### 응답 검증

서버에서 AI 응답을 저장·반환하기 전에 검증한다.

- 설명 필드가 비어 있지 않은지 확인
- 각 설명의 최대 길이 제한
- 연관 키워드 최대 5개
- 추천 자료 최대 3개
- 자료 URL은 서버가 허용 목록 템플릿으로만 만든다(AI가 준 URL을 쓰지 않으므로 스킴·사설망 검사가 필요 없다)
- 허용 목록에 없는 사이트 키, 빈 검색어는 버린다
- 프론트는 링크를 새 탭에서 열고 `noopener noreferrer` 적용
- 외부 사이트를 iframe으로 삽입하지 않음

## 7. 현재 노트 삽입

1차 구현에서는 새 Tiptap 노드를 만들지 않고 기존 노드만 사용한다.

권장 삽입 형태:

```json
{
  "type": "blockquote",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "JWT: 서버와 클라이언트 사이에서 인증 정보를 전달하는 토큰이다."
        }
      ]
    }
  ]
}
```

이유:

- DB 스키마 변경 없음
- 기존 Tiptap JSON과 호환
- 공유 노트와 읽기 전용 뷰어에서 즉시 표시
- 기존 자동 저장 흐름 재사용

2차에서 탭·삭제·다시 생성·AI 표시를 독립적으로 제공해야 할 때 `keywordExplanation` NodeView 도입을 검토한다.

## 8. 프론트엔드 구성

```text
frontend/src/
├─ components/
│  └─ editor/
│     └─ components/
│        ├─ KeywordSelectionMenu.jsx
│        └─ KeywordExplainPanel.jsx
└─ hooks/
   ├─ useKeywordExplanation.js
   └─ useKeywordMentions.js
```

API 호출은 기존 패턴대로 hook에서 `api/client.js`를 직접 쓴다(별도 `keywordApi.js`를 두지 않는다). 선택 메뉴 위치는 `editor.view.coordsAtPos`로 계산한다. `@tiptap/extension-bubble-menu`는 간접 의존성으로만 설치되어 있어, 쓰려면 `package.json`에 명시해야 한다.

### 역할

- `KeywordSelectionMenu`
  - Tiptap selection 감지
  - 선택 텍스트·문맥·블록 ID 추출
  - 설명·문제 만들기 버튼 제공
- `KeywordExplainPanel`
  - 탭 전환
  - 설명 표시
  - 관련 자료·연관 키워드 표시
  - 노트 언급 목록 표시
  - 문제 생성·설명 삽입 액션 제공
- `useKeywordExplanation`
  - 설명 API 호출
  - 키워드별 요청 상태와 캐시 관리
  - 동일 요청 중복 방지
- `useKeywordMentions`
  - 노트 언급 검색 API 호출
  - 로딩·오류·빈 상태 관리

`NotionEditor.jsx`와 `CourseDetailPage.jsx`에 모든 상태를 추가하지 않는다. 두 파일은 이미 책임이 크므로 selection, API, 패널 표시를 분리한다.

## 9. 캐시·호출 제한

초기에는 영구 저장 없이 프론트 세션 캐시를 사용한다.

캐시 키:

```text
noteId + blockId + normalizedKeyword + contextHash
```

권장 제한:

- 사용자별 설명 요청: 10분에 20회. `QuizService`의 학생별 시간창 제한(`acquireGenerationSlot`)과 같은 방식이며, 서버 메모리에만 있어 재시작하면 초기화된다
- 키워드 최대 80자
- 문맥 최대 2,000자
- 연관 키워드 최대 5개
- 추천 자료 최대 3개
- 설명 결과 최대 10,000자
- 동일 키워드·문맥 요청은 캐시 결과 재사용

실제 사용량이 확인되면 `KeywordExplanation` 엔티티와 DB 캐시를 추가한다.

## 10. 구현 단계

### 1단계: 설명 패널 MVP

- 키워드 선택 감지
- 선택 메뉴 표시
- 키워드 설명 API와 DTO 추가
- Gemini 호출을 `GeminiClient`로 분리(퀴즈 동작 불변)
- Gemini 구조화 응답 생성
- 응답 검증
- 설명 패널의 3개 탭
- 연관 키워드와 안전한 관련 링크
- 로딩·오류·빈 상태
- 프론트 세션 캐시

### 2단계: 노트·퀴즈 연계

- 현재 노트 언급 검색 API
- 언급 목록 표시와 해당 노트 이동
- `QuizConfigModal`을 선택 블록 범위·키워드 개념(`blockSelections`, `focusConcepts`)이 채워진 상태로 열기
- 기존 `CBTPlayer`로 문제 풀이 연결

### 3단계: 설명 삽입

- 현재 선택 위치 또는 블록 뒤에 blockquote 설명 삽입
- "노트에 적용"을 누르면 넣을 내용을 미리 보여 주고, 사용자가 적용·적용 안 함을 고른 뒤에만 넣는다(공통 확인 모달 재사용)
- 자동 저장 상태와 연동
- 저장 실패 시 기존 재시도 UI 사용
- 삽입된 설명의 출처·생성 표시

### 4단계: 개인화 확장

- 설명 결과 영구 저장
- ~~키워드별 조회·풀이·오답 통계, 키워드별 복습 카드~~ → 오답노트 "취약 개념" 카드로 대신한다(조회 수 기록용 새 테이블은 만들지 않는다).
- 필요할 때 `keywordExplanation` NodeView 도입

## 11. 검증 계획

### Backend

- 설명 요청 DTO의 키워드·문맥 길이 검증
- 인증된 사용자의 요청인지 확인
- AI 응답 JSON 파싱 실패 처리
- 빈 설명·길이 초과 차단
- 자료 URL이 허용 목록 템플릿으로만 만들어지는지, 허용 목록 밖 사이트 키가 버려지는지 확인
- 관련 키워드·자료 개수 제한
- 다른 학생의 `noteId`로 설명 요청 시 거부
- 노트 언급 검색이 다른 학생·다른 강의의 노트를 반환하지 않는지 확인
- 존재하지 않는 노트·블록 문맥 처리
- 키워드 설명 요청 제한
- `GeminiClient` 분리 후 기존 퀴즈 생성 테스트 전체 통과

### Frontend

- 텍스트 선택 시 메뉴 표시
- 80자 초과 선택 시 비활성화·안내
- 패널 탭 전환
- 로딩·오류·빈 상태
- 관련 링크의 안전한 속성
- 언급 결과 클릭 이동
- 설명 버튼이 기존 CBT 설정 화면을 올바르게 여는지 확인
- 기존 퀴즈 생성·풀이·오답노트 회귀
- 자동 저장 중 설명 삽입 동작
- 키워드 패널과 커뮤니티 패널이 동시에 열리지 않는지 확인

### 명령

```powershell
cd backend
.\gradlew.bat test

cd ..\frontend
npm run lint
npm run test
npm run build
```

## 12. 완료 기준

- 노트에서 유효한 텍스트를 선택하면 키워드 액션 메뉴가 표시된다.
- 키워드 설명 패널이 3개 탭의 설명을 표시한다.
- AI 응답 실패가 성공처럼 보이지 않고 사용자에게 오류가 표시된다.
- AI가 만든 URL은 화면에 링크되지 않고, 허용 목록 사이트의 검색 링크만 표시된다.
- 현재 학생·현재 강의의 노트 언급만 반환된다.
- 키워드에서 기존 CBT 생성 흐름으로 이동할 수 있다.
- 키워드 연계 문제 생성이 기존 요청 필드만 쓰고, 출처 검증·호출 제한·중복 검사를 그대로 거친다.
- 설명 삽입 시 기존 Tiptap JSON과 자동 저장 계약이 유지된다.
- 기존 노트·퀴즈·풀이·오답노트 기능의 API와 화면 동작이 변하지 않는다.
