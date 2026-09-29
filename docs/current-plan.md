# 블록 목록에서 내용 없는 블록 제외 구현 계획 (2026-09-29)

AI 문제 생성 모달(`QuizConfigModal`)의 노트별 블록 목록에서, 내용이 없는 블록(빈 줄 등)은 체크박스를 보이지 않게 한다. frontend만 변경하고 API·서버·DB는 변경하지 않는다.

## 배경

- 빈 문단처럼 내용이 없는 블록도 목록에 "(내용 없음)" 체크박스로 나온다.
- 이런 블록은 선택해도 AI 입력에 아무것도 더하지 않는다. 서버는 텍스트·이미지·PDF만 추출한다(`QuizAiGenerationService.extractDataFromNode`).
- 그런데도 "블록 N개" 수와 선택 요약에는 포함되어 혼란을 준다.
- 이미지 블록도 텍스트가 없어 "(내용 없음)"으로 표시된다. 하지만 서버는 이미지를 AI 입력(미디어)으로 쓰므로 실제로는 내용이 있는 블록이다.

## 현재 코드 기준점

- `parseNoteBlocks`: 제목(`content[0]`)을 뺀 최상위 노드 중 `attrs.id`가 있는 노드를 모두 목록에 넣는다. 미리보기는 `collectText` 결과다.
- `NoteBlockPanel`: 미리보기가 비면 "(내용 없음)"으로 표시한다.
- `getBlockRangeIds`(heading 범위 선택), `toggleBlock`(전체 → 일부 전환), payload의 `blockIds`는 모두 이 블록 목록을 기준으로 한다.

## 구현 단계

### 1. "내용 있음" 기준을 서버 추출 기준에 맞춘다

- 블록 안(하위 포함)에 공백이 아닌 텍스트가 있거나, `image` 또는 `pdfBlock` 노드가 있으면 내용이 있는 블록이다.
- `collectText`처럼 재귀로 `image`·`pdfBlock`을 찾는 헬퍼 `hasMedia(node)`를 추가한다.

### 2. 내용 없는 블록은 목록에서 제외한다

- `parseNoteBlocks`에서 내용 없는 블록을 목록에 넣지 않는다. 체크박스만 숨기지 않고 행 자체를 뺀다. 행을 남기면 빈 줄이 목록 사이에 끼어 목록만 길어지기 때문이다.
- 목록에서 빼면 다음에서도 빈 블록이 자연히 빠진다.
  - "블록 N개" 수
  - heading 범위 선택
  - 전체 → 일부 전환
  - payload `blockIds`
- 제외한 블록은 `hasUnselectable`(PDF 등 안내)에 포함하지 않는다.
- 빈 heading도 제외된다. 그래서 heading 범위 선택은 빈 heading을 경계로 보지 않고 다음 heading까지 이어진다.

### 3. 이미지 블록 미리보기

- 텍스트가 없는 이미지 블록은 "(내용 없음)" 대신 "(이미지)"로 표시한다. 유형 배지는 기존대로 "이미지"다.

### 4. 모든 블록이 비어 있을 때

- 기존 문구 "선택할 수 있는 블록이 없습니다."를 그대로 쓴다.

## 수정 대상 파일

- `frontend/src/components/editor/components/QuizConfigModal.jsx` (`parseNoteBlocks`, `hasMedia`, `NoteBlockPanel` 미리보기 문구)
- `frontend/src/components/editor/components/QuizConfigModal.test.jsx`

## 테스트

- 빈 문단(`content` 없음)과 공백만 있는 문단은 목록에 나오지 않는다(체크박스 없음).
- 텍스트 없는 이미지 블록은 목록에 나오고, 미리보기가 "(이미지)"다.
- 빈 블록 사이의 heading을 선택하면, 범위 선택과 payload `blockIds`에 빈 블록 id가 들어가지 않는다.
- 기존 블록 선택 테스트는 모두 계속 통과한다.

## 검증

```powershell
cd frontend
npm run lint
npm run build
npm run test
```

backend 변경이 없으므로 backend 테스트는 생략한다.

수동 확인: 빈 줄이 있는 노트에서 "블록"을 펼쳤을 때 빈 줄이 목록에 없는지, 이미지 블록이 "(이미지)"로 보이는지 확인한다.

## 참고

- 여러 노트 블록 선택(`blockSelections`) 구현은 완료했지만 아직 커밋하지 않았다.

## 이전 작업 미확인 항목

- `quiz.generation` 결과 로그를 실제 Gemini 호출로 확인하지 않았다 (`e88c237`).
- OSIV(`spring.jpa.open-in-view` 기본값 true) 상태에서 AI 호출 동안 DB 커넥션이 반환되는지 확인하지 않았다 (09-28 작업). 설정 변경은 범위 밖이다.
- 09-28 작업의 수동 확인 4개(정상 생성 후 원문 이동, 빈 노트 alert, 출처 null 문항의 "원문 보기" 숨김, 오답노트·오늘의 복습 원문 이동)를 하지 않았다.

## 완료 기준

- 내용 없는 블록은 블록 목록에 체크박스로 나오지 않고, 선택 수·payload에도 들어가지 않는다.
- 이미지 블록은 선택할 수 있고 "(이미지)"로 표시된다.
- API·서버·DB 동작은 변경되지 않는다.
