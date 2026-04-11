# UniNote Project Context & Rules

이 문서는 UniNote 프로젝트의 핵심 설계 원칙과 개발 규칙을 담고 있습니다. 모든 작업은 이 가이드라인을 최우선으로 준수해야 합니다.

## 1. 프로젝트 개요 (Context)
- **명칭**: UniNote (유니노트)
- **목표**: 대학생을 위한 강의 기반 노트 공유 및 익명 커뮤니티 플랫폼.
- **주요 기능**: 
  - JWT 기반 회원 인증.
  - 강의별 노트 작성, 공유 및 관리.
  - 익명 게시판을 통한 학생 간 소통.
  - 개인별 수강 강의 대시보드.

## 2. 기술 스택 (Tech Stack)
### Backend
- **Language**: Java 17
- **Framework**: Spring Boot 3.x
- **Security**: Spring Security + JWT (JSON Web Token)
- **Database**: JPA (Spring Data JPA) / Hibernate
- **Build Tool**: Gradle

### Frontend
- **Framework**: React (Vite 기반)
- **Styling**: Tailwind CSS v4
- **State/Routing**: React Router v7, Axios
- **Iconography**: Lucide-React

## 3. 개발 및 협업 규칙 (Rules)
### 워크플로우: 하네스 엔지니어링 (Harness Engineering)
모든 태스크는 다음의 4단계를 엄격히 준수한다.
1. **Research (연구)**: 기존 코드, DB 구조, API 설계를 완벽히 파악하고 영향을 분석한다.
2. **Strategy (전략)**: 변경 사항에 대한 설계안을 수립하고 필요시 사용자 승인을 받는다 (`enter_plan_mode` 활용).
3. **Execution (실행)**: 정밀한 코드 수정을 진행하며, 기존 컨벤션을 유지한다.
4. **Validation (검증)**: 빌드, 린트, 테스트 및 실제 동작 확인을 통해 무결성을 보장한다.

### 보안 및 코드 스타일
- **보안**: API 요청 시 Header에 JWT 토큰을 포함하는 인터셉터(`api/client.js`)를 필수로 사용한다.
- **프런트엔드**: 컴포넌트 기반 설계를 따르며, `src/pages`에 화면 단위 로직을 위치시킨다. Styling은 Tailwind CSS 유틸리티 클래스를 우선 사용한다.
- **백엔드**: RESTful API 원칙을 준수하며, Controller-Service-Repository-Domain(Entity) 계층 구조를 유지한다.
- **메모리**: 중요한 로컬 설정이나 워크플로우 팁은 `save_memory`를 통해 기록한다.

## 4. 주요 디렉토리 구조
- `backend/src/main/java/com/uninote/backend/`: 백엔드 핵심 소스 코드.
- `frontend/src/pages/`: 프런트엔드 화면 단위 컴포넌트.
- `frontend/src/api/`: 백엔드 통신(Axios) 설정.
- `docs/`: 프로젝트 설계 및 요구사항 문서.
- `ui이미지/`: UI 디자인 가이드 이미지.

---
*본 문서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*
