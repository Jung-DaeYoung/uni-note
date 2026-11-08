# 학년·학기별 강의 목록 관리 기능 (축소안, 구현 완료)

## 결정 사항

- 학생은 학교 강의에 스스로 등록하지 않는다. 수강(`Enrollment`)은 학교 시스템이 등록한다고 보고 시드 SQL로 넣는다. 수강 등록·수정·삭제 API, 학년 설정 API, 강의 카탈로그 검색, 미분류 이행 화면, `Student.currentYear`는 만들지 않는다.
- 기준 학기는 4학년 2학기다. 기존 Enrollment는 4학년 1학기로 옮긴다.
- 4학년 2학기 강의: 캡스톤디자인Ⅱ, 소프트웨어공학, 자료구조와 알고리즘, 통계응용. 1~3학년 학기별 강의는 임의로 넣는다.
- 현재 학기는 저장하지 않고 수강 중 가장 늦은 (학년, 학기)로 본다.
- 한 강의는 학생당 한 학기에만 둔다: unique(`stud_id`, `course_id`). 재수강은 범위 밖이다. 이 제약 덕분에 기존 `findByStudent`·`existsByStudentAndCourse_CourseId` 사용처(대시보드·마이페이지·검색·공유·권한 검사)는 바뀌지 않는다.
- 지난 학기 강의도 Enrollment가 있으므로 노트·게시판·공유 접근은 그대로다.

## 구현 내용

- Backend
  - `Enrollment`: `academicYear`(`academic_year`), `semester` (NOT NULL), unique(`stud_id`, `course_id`).
  - `CourseResponse`: `academicYear`, `semester` 추가. 직접 생성 강의는 null.
  - `DashboardService`: 수강 강의 응답에 학년·학기를 채운다. 새 API는 없다.
- DB: DDL과 시드 SQL은 `docs/database.md`의 "학년·학기별 수강"에 있다. 로컬 DB에는 적용했다. 운영 RDS에는 배포 전 직접 실행해야 한다.
- Frontend
  - `CourseContext`: 강의 목록은 그대로 두고 `currentTerm`(가장 늦은 학년·학기)만 추가했다. 검색·공유게시판·퀴즈의 강의 선택에는 지금처럼 전체 강의가 나온다.
  - `CourseContext`: 선택 학기(`selectedTerm`)를 두어 페이지를 옮겨도 유지한다. 새로고침하면 현재 학기로 돌아간다.
  - 사이드바(`AppLayout`): "수강 중인 강의" 옆 학기 드롭다운으로 학기를 고르고, 그 학기 강의만 보여 준다.
  - 강의목록 페이지(`DashboardPage`): 선택한 학기의 수강 강의만 보여 준다. 지난 학기 목록은 따로 두지 않는다.
  - 마이페이지 "강의별 학습 현황": 최근 활동처럼 5개씩 페이지로 나눈다(화면에서만 나눔, API 변경 없음).
- 문서: `docs/api.md`의 `CourseResponse` 필드, `docs/database.md`의 enrollments 구조·DDL·시드.

## 검증

- `backend\gradlew.bat test` 통과 (`DashboardServiceTest`에 학년·학기 단언 추가).
- `npm run lint`, `npm test`, `npm run build` 통과.
- 로컬 DB에서 학기별 수강 건수를 확인했다.

## 남은 작업

- 운영 RDS에 DDL과 시드를 적용해야 한다. 시드의 `<학번>`은 실제 학번으로 바꿔서 실행한다.
- 선택 학기를 서버에 저장하는 기능과 재수강은 요구가 생기면 추가한다.
