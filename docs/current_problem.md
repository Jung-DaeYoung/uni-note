# UI Hallmark 적용 현황 점검

저장소의 UI 소스와 작업 기록을 읽어 확인한 결과다. 코드는 수정하지 않았다. 실제 브라우저 화면은 이번 점검에서 직접 검증하지 않았으므로, 소스에서 확인한 스타일과 화면 검증 여부를 구분한다.

## 요약

주요 페이지와 공통 컴포넌트에는 Hallmark 또는 공통 `lib-*` 디자인 체계가 적용되어 있다. 다만 노트 화면의 경로 표시와 편집기 주변에는 기존 스타일이 일부 남아 있다. 특히 에디터 본문은 인라인 스타일로 관리되고, 페이지 링크 블록은 배경·테두리·그림자와 이모지 아이콘을 사용한다.

## 미적용 또는 부분 적용 영역

| 우선순위 | 영역 | 확인 내용 | 근거 |
|---|---|---|---|
| 높음 | 노트 경로 표시(브레드크럼) | 강의·노트 경로가 Tailwind 유틸리티 클래스로 직접 구성되어 있다. Hallmark 전용 스타일 적용은 확인되지 않는다. | [`CourseDetailPage.jsx`](../frontend/src/pages/CourseDetailPage.jsx#L151) |
| 높음 | 노트 편집기 본문 | 본문 타이포그래피, 인용 블록, 이미지, 블록 호버 등의 스타일이 `NotionEditor.jsx` 내부 인라인 `<style>`에 남아 있다. `NotionEditor.css`에는 업로드 상태 등 일부 주변 요소 스타일만 확인된다. | [`NotionEditor.jsx`](../frontend/src/components/editor/NotionEditor.jsx#L444), [`NotionEditor.css`](../frontend/src/components/editor/NotionEditor.css) |
| 높음 | 페이지 링크 블록 | 페이지 링크가 이모지 아이콘을 표시하며, 배경·테두리·그림자와 호버 스타일을 사용한다. Hallmark 디자인 체계로 정리된 흔적은 확인되지 않는다. | [`PageLink.jsx`](../frontend/src/components/editor/extensions/PageLink.jsx#L18), [`NotionEditor.jsx`](../frontend/src/components/editor/NotionEditor.jsx#L498) |
| 보통 | 사이드바 상단 브랜드 영역 | 사이드바 메뉴 스타일 시트에는 Hallmark 정의가 있지만, 상단의 U 로고와 UniNote 이름 영역은 Tailwind 클래스 중심으로 구현되어 있다. | [`AppLayout.jsx`](../frontend/src/components/layout/AppLayout.jsx#L124) |
| 확인 필요 | 노트 로딩 상태 | 노트를 불러오는 동안 낮은 불투명도의 아이콘과 문구를 표시한다. 소스상 로딩 표현은 확인했으나, 빈 상태 디자인과 구분해 실제 화면에서 적절성을 확인하지는 않았다. | [`CourseDetailPage.jsx`](../frontend/src/pages/CourseDetailPage.jsx#L289) |

## 적용 완료 기록과 검증 한계

`docs/1108.md`의 작업 기록에 따르면 오답노트 담기 모달, 댓글, PDF 블록, 코드 언어 선택, 블록 핸들, 키워드 선택 막대, 에디터 업로드 상태를 기존 `lib-*` / `cf-*` 디자인 체계로 옮겼다. 노트 헤더의 주요 액션 버튼도 별도 polish가 기록되어 있다.

다만 같은 기록은 PDF 블록, 코드 언어 선택, 블록 메뉴, 업로드 상태를 화면에서 직접 확인하지 못했고, 에디터 화면 캡처도 시간 초과로 실패했다고 명시한다. 따라서 이 항목들은 **스타일 정리 기록은 있으나 화면 검증은 제한적**인 상태로 본다.

## 권장 검토 순서

1. 브레드크럼을 노트 헤더의 공통 디자인 토큰과 맞춘다.
2. 에디터 본문과 페이지 링크 블록의 스타일을 검토한다. 편집·저장 동작은 건드리지 않고 시각 스타일 범위에서 확인한다.
3. 사이드바 브랜드 영역과 로딩 상태가 앱 전체 디자인 체계에 맞는지 살펴본다.
4. 테스트용 노트에서 PDF, 코드 선택, 블록 메뉴, 업로드 상태를 실제 화면으로 확인한다.

## 점검 범위

- 저장소의 UI 소스와 `docs/1101.md`, `docs/1108.md` 작업 기록을 읽어 대조했다.
- 브라우저 화면 캡처나 실제 사용자 데이터로 동작 검증은 하지 않았다.
- 이 문서는 디자인 적용 및 검증 현황을 정리하며, 코드 변경 사항은 포함하지 않는다.
