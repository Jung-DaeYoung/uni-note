# UniNote 작업 계획

## 현재 목표

기존 기능과 API·DB·인증 계약을 유지하면서
보안/회귀 위험이 높은 백엔드부터 안정화하고 책임이 집중된 코드를 단계적으로 분리한다.

## 우선 작업

### 1. 설정·인증·권한 안전망
- 대상: application.yaml, security, GlobalExceptionHandler, 관련 Service, backend tests
- 설정 분리, 예외 응답 정리, 리소스 접근 권한 검증 통일
- 인증·권한·노트·게시판·퀴즈 핵심 테스트 추가
- 보존: JWT, 401/403, API 응답, 노트 저장 형식
- 검증: `gradlew.bat test` + 핵심 API 확인

### 2. QuizService 책임 분리
- 대상: QuizService, IncorrectNoteService, 관련 DTO/Repository
- AI 요청, 콘텐츠 처리, 응답 변환, 저장 책임 분리
- Question 응답 변환 공통화
- 보존: 퀴즈 생성/풀이/오답노트, sourceNoteId/sourceBlockId
- 검증: backend test + 퀴즈 전체 흐름 확인

### 3. Frontend 책임 분리
- 대상: CourseDetailPage, NotionEditor, QuizLibraryPage, api/client.js
- 페이지 상태/CRUD와 에디터 저장·업로드·출처·퀴즈 로직 분리
- 보존: Tiptap JSON, BlockId/PageLink/PdfBlock,
  autosave, localStorage 복구
- 검증: `npm run lint`, `npm run build` + 주요 시나리오

## 완료 조건

- [ ] 현재 작업 구현
- [ ] 관련 테스트/빌드 통과
- [ ] 기존 기능 및 API 계약 확인