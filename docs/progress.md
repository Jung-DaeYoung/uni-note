# UniNote Project Progress (2026-04-13)

이 문서는 UniNote 프로젝트의 현재 개발 진행 상황과 향후 추진 계획을 관리합니다.

## 📊 현재 진행률: 약 85%
- 핵심 도메인 설계 및 기본 UI/UX 구조 구축 완료.
- **인증 시스템 및 데이터베이스 스키마 정합성 해결 완료.**
- **익명 게시판 본인 확인(isAuthor) 및 삭제 권한 로직 고도화 완료.**
- 프론트-백엔드 간의 실시간성 UI 연동 및 레이아웃 최적화 완료.

---

## ✅ 완료된 작업 (Completed)

### 1. 백엔드 (Backend)
- [x] **도메인 모델 설계**: Student, Professor, Course, Note, Post, Enrollment 엔티티 구축.
- [x] **인증 시스템**: 
    - [x] Spring Security + JWT 기반 로그인 및 토큰 필터 구현.
    - [x] 로그인 실패 시 `401 Unauthorized` 응답 및 비밀번호 `trim()` 처리.
- [x] **스키마 정합성**: 모든 엔티티와 실제 DB 컬럼명(`stud_id` 등) 동기화 완료.
- [x] **API 및 DTO 최적화**: 
    - [x] `PostResponse`, `CommentResponse` 내 `isAuthor` 필드 추가.
    - [x] 사용하지 않는 필드(isAnonymous, aiSummary, major 등) 제거 및 코드 경량화.
- [x] **게시판 고도화**: 게시글 작성 및 삭제 본인 확인 로직 강화.

### 2. 프론트엔드 (Frontend)
- [x] **환경 구축**: Vite + React + Tailwind CSS v4 디자인 시스템 도입.
- [x] **핵심 페이지 구현**: `LoginPage`, `DashboardPage`, `CourseDetailPage`.
- [x] **UI/UX 개선**:
    - [x] 왼쪽 사이드바 너비 축소(256px -> 200px) 및 헤더 검색창 제거.
    - [x] 노트 작성 영역 극대화 및 불필요한 헤더 요소 정리.
    - [x] `isAuthor` 필드를 활용한 게시글 삭제 버튼 노출 제어.
- [x] **스마트 기능**: 노트 작성 시 디바운싱 기반 자동 저장(Auto-save) 구현.

---

## 🏃 진행 중인 작업 (In Progress)

- [ ] **댓글 삭제 및 관리**: 댓글 상세 정보 내 본인 확인(`isAuthor`) 및 삭제 기능 UI 연동.
- [ ] **대시보드 활동 시각화**: GitHub 스타일의 활동 히트맵(Heatmap) 데이터 연동.
- [ ] **에디터 고도화**: 마크다운(Markdown) 지원 및 리치 텍스트 기능 강화.

---

## 📅 향후 계획 (TODO / Roadmap)

### 1단계: 기능 고도화
- [ ] **AI Engine 연동**: Gemini API를 활용한 필기 내용 요약 및 퀴즈 생성 (기존 설계 기반 재구축).
- [ ] **파일 관리**: 강의 자료(PDF, 이미지) 업로드 및 노트 내 삽입 기능.

### 2단계: 사용자 경험 개선
- [ ] **게시판 상호작용**: 게시글 좋아요(공감) 기능 및 실시간 알림 시스템.
- [ ] **노트 히스토리**: 날짜별/주차별 노트 기록 관리 기능.

### 3단계: 안정화 및 배포
- [ ] **테스트 코드**: JUnit 및 Vitest를 활용한 서비스 안정성 검증.
- [ ] **배포**: Docker 컨테이너화 및 클라우드(AWS/GCP) 환경 구축.

---
*마지막 업데이트: 2026-04-13 (Gemini CLI)*
