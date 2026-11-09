# 프로젝트 진행 상황 (Progress Report) - 2026-05-30

## ✅ 완료된 작업 (Completed)
- **AI 퀴즈 출처 추적 (Origin Tracking)**:
  - 퀴즈 문항 클릭 시 에디터의 정답 근거 블록으로 자동 이동 및 하이라이팅 기능 구현.
  - 백엔드 텍스트 추출 시 블록 ID 메타데이터 주입 및 Gemini 프롬프트 고도화.
- **학습 결과 리포트 재조회 시스템**:
  - 퀴즈 풀이 결과(점수, 답안, 해설) DB 영구 저장 기능 구축.
  - `CBTPlayer`의 모드(Solve/Report) 분리를 통한 과거 기록 완벽 재현.
- **학습 보관함(Quiz Library) UX 혁신**:
  - 탭 시스템을 통한 생성 퀴즈와 풀이 기록의 효율적 관리.
  - 퀴즈 카드별 상세 기록 조회 모달(`QuizAttemptsModal`) 통합.
- **시스템 정합성 및 버그 픽스**:
  - 퀴즈 생성 직후 DB ID 유실로 인한 저장 실패 버그 해결.
  - 과거 기록 정렬 및 조회 시 발생하던 NullPointerException(NPE) 전수 방어.
  - 컴포넌트 깊이에 따른 Import 경로 및 구문 오류 정제.

## 🚀 진행 예정 작업 (Next Steps)
1. **에디터 성능 최적화**: 대용량 노트 로딩 및 블록 드래그 앤 드롭 성능 개선.
2. **AI 오답 분석**: 틀린 문제를 기반으로 AI가 추가 학습 방향을 제시하는 기능 검토.
3. **코드 블록 확장**: 코드 복사 버튼 추가 및 언어별 아이콘 표시.

## ⚠️ 주의사항 및 롤백 포인트
- `QuizService`의 AI 프롬프트 수정 시 JSON Schema 형식을 엄격히 유지해야 함 (ID 주입 로직 필수).
- 에디터 하이라이팅 애니메이션은 Tiptap의 렌더링 주기에 맞춰 `setTimeout` 지연 시간을 적절히 조절해야 함.

---

# AWS 운영 배포 검증 보고서 - 2026-11-07

## 1. 확인된 현재 상태

### 인프라

- EC2: Ubuntu 24.04 LTS, t3.small, RAM 2GB, EBS 20GiB gp3
- 리전: `ap-southeast-2`
- RDS: MySQL 8.4, `uninote_db`, Public Access 비활성화
- EC2와 RDS는 같은 VPC 사용
- EC2 Security Group은 SSH를 관리자 IP로 제한하고 80/443만 외부 공개
- 8080은 외부 직접 접근 차단
- RDS 3306은 EC2 Security Group에서만 허용
- Elastic IP와 DuckDNS 도메인 사용 예정

### 배포 준비

- Docker Engine 및 Docker Compose 설치 완료
- Java 21 기반 Backend 이미지 빌드 성공
- 이미지: `uninote-backend:latest`
- Dockerfile은 JDK 빌드 단계와 JRE 실행 단계를 분리함
- `.dockerignore`에서 `application-local.yaml`, `uploads`, build 산출물을 제외함
- Backend 컨테이너는 아직 실행하지 않음
- `/opt/uninote/uploads` bind mount는 아직 연결하지 않음
- Nginx와 HTTPS는 아직 구성하지 않음

### RDS 연결

- 올바른 RDS endpoint는 다음과 같음.
  `uninote-db.cz2mg06mm9bk.ap-southeast-2.rds.amazonaws.com`
- 이전에 `c22mg06mm9bk` 오타로 NXDOMAIN이 발생했으나 올바른 endpoint로 수정함
- EC2에서 RDS DNS 조회, 사설 IP 확인, MySQL 접속을 완료함
- MySQL CLI에서 RDS CA bundle을 사용한 `VERIFY_IDENTITY` 연결을 확인함
- 다만 제시된 일부 CLI 예시에는 이전 오타가 남아 있으므로 실행 기록과 설정에서 제거해야 함
- Java JDBC 연결의 CA 신뢰 및 hostname 검증은 아직 미완료

## 2. 프로젝트 설정 검증 결과

### Backend 운영 설정

- Spring Boot: 3.4.2
- Java: 21
- MySQL Connector/J: 9.1.0
- 운영 프로파일: `SPRING_PROFILES_ACTIVE=prod`
- 운영 JPA: `ddl-auto: validate`
- 현재 JDBC URL은 `useSSL=true&requireSSL=true`이며 `VERIFY_IDENTITY`가 아님
- 운영 CORS는 `CORS_ALLOWED_ORIGINS` 환경변수로 주입됨
- 업로드 제한은 파일·요청 각각 10MB
- 파일 서명 키는 `FILE_SIGNING_SECRET`이 없으면 `JWT_SECRET`을 fallback으로 사용함
- Actuator health endpoint는 없음
- Gemini RestTemplate read timeout은 60초임

### 운영 환경변수

기본 9개 외에 실제 운영에서 확인해야 할 값은 다음과 같음.

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_EXPIRATION`
- `FILE_SIGNING_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `GEMINI_API_KEY`
- `TZ`
- `TRUSTSTORE_PASSWORD`

`FILE_SIGNING_SECRET`을 생략하는 현재 방식은 동작하지만 JWT secret 교체 시 기존 이미지·PDF 서명이 깨질 수 있음. 기존 데이터를 유지하는 동안에는 기존 signing secret을 유지해야 함.

운영 env 파일은 기존 EC2 설정에 맞춰 `~/uni-note/backend.env`(= `/home/ubuntu/uni-note/backend.env`)로 확정함. 권한 600을 유지해야 함.

## 3. 기술 검증 결론

### 아키텍처

Netlify → EC2 Nginx → localhost Docker Backend → private RDS 구조는 UniNote의 테스트·발표용 운영 환경에 적절함. Kubernetes, ECS, ElastiCache 등은 현재 규모에서 불필요함.

### RDS SSL

운영 JDBC에는 다음을 사용해야 함.

- `sslMode=VERIFY_IDENTITY`
- RDS endpoint hostname 사용
- `allowPublicKeyRetrieval=false`
- RDS CA를 PKCS12 또는 JKS TrustStore로 등록
- TrustStore 파일을 컨테이너에 read-only 마운트

PKCS12가 현재 권장 방식임. PEM 직접 사용도 Connector/J 9.1에서 가능할 수 있으나, 현재 배포에서는 PKCS12로 변환해 런타임 차이를 줄이는 것이 안전함. CA bundle에 여러 인증서가 있으면 모두 TrustStore에 가져와야 함.

JVM 전체 TrustStore를 교체하지 말고 JDBC 연결에만 TrustStore를 지정해야 Gemini 등 다른 HTTPS 연결에 영향을 주지 않음.

### 메모리

t3.small 2GB에서 Docker, Spring Boot, Nginx 운영은 가능하지만 여유가 적음. PDF 기반 AI 문제 생성 시 메모리 급증 가능성이 있으므로 2GB swap, Docker 로그 로테이션, `docker stats` 확인이 필요함. 장시간 부하가 지속되면 인스턴스 상향을 검토함.

### AI timeout

현재 Backend Gemini read timeout은 60초지만 문서상 AI 생성은 최대 약 90초임. Nginx timeout을 120초로 설정해도 Backend가 먼저 60초에 실패할 수 있으므로 Backend timeout도 최소 120초 이상으로 조정해야 함.

### 데이터 이전과 JPA validate

RDS에 테이블이 없으면 `ddl-auto: validate`에서 Hibernate schema validation 오류가 발생하고 애플리케이션이 기동하지 않음. `validate`는 스키마를 생성하지 않으며, DB에 남은 불필요한 추가 컬럼까지 정리하지도 않음.

로컬 MySQL에서 RDS MySQL 8.4로 이전할 때 다음을 비교해야 함.

- 테이블·컬럼·타입·NULL 조건
- 문자셋과 collation
- SQL mode와 timezone
- 테이블별 행 수
- `notes.created_at`
- 외래키와 자동 증가 값
- DB가 참조하는 업로드 파일의 실제 존재 여부
- 실제 INSERT/UPDATE 동작

### 업로드 저장

`/opt/uninote/uploads:/app/uploads` bind mount는 초기 운영 방식으로 적절함. 단, EC2 장애·교체에 대비해 EBS snapshot 또는 AWS Backup이 필요함. 장기적으로 S3 이전을 검토할 수 있으나 현재 배포에 즉시 추가할 필요는 없음.

### Nginx·HTTPS·Netlify

Nginx에는 다음이 필요함.

- Backend proxy 대상 `127.0.0.1:8080`
- `client_max_body_size 11m`
- AI 처리를 위한 `proxy_read_timeout` 120초 이상
- `X-Forwarded-Proto`, `X-Forwarded-For`, `X-Real-IP`
- HTTP에서 HTTPS redirect

Netlify의 `VITE_API_BASE_URL`은 `https://uninote.duckdns.org`로 설정하고, Backend `CORS_ALLOWED_ORIGINS`에는 실제 Netlify origin을 trailing slash 없이 정확히 입력해야 함. 환경변수 변경 후 Netlify 재배포가 필요함.

## 4. 보안·운영 주의사항

- Docker 포트는 `127.0.0.1:8080:8080`으로만 바인딩
- Security Group에서 8080 미개방 유지
- RDS Public Access 비활성화 유지
- SSH는 관리자 IP만 허용
- env 파일, DB dump, 인증서 변환 임시 파일은 Git과 Docker 이미지에 포함하지 않음
- `latest` 외 Git SHA 이미지 태그 사용
- Docker 로그 크기 제한
- RDS 자동 백업·삭제 방지 확인
- EC2 EBS snapshot 또는 AWS Backup 설정
- 배포 후 DB·JWT·파일 서명·Gemini 키가 이미지에 포함되지 않았는지 확인

## 5. 종합 결론

현재 AWS 인프라와 Docker 기반 배포 방향은 적절함. 배포 전 반드시 `VERIFY_IDENTITY` JDBC 설정, RDS 데이터·스키마 이전, 업로드 bind mount, Backend timeout 조정, 백업 설정을 완료해야 함. 특히 `requireSSL`만으로 인증서 hostname 검증이 끝났다고 판단하면 안 됨.

---

# Backend Docker 배포 환경 구축 현황 - 2026-11-07 13:15

## 완료된 작업

- 운영 환경변수 파일 `~/uni-note/backend.env` 준비
- RDS CA 루트 인증서 기반 `rds-truststore.p12` 준비
- 2GB RAM EC2에 맞춘 `docker-compose.yml` 작성
- JVM 메모리 제한 설정:
  - `-Xms256m`
  - `-Xmx768m`
- Backend 포트를 `127.0.0.1:8080:8080`으로 로컬에만 바인딩
- 업로드 영속 볼륨 연결:
  - EC2 `/opt/uninote/uploads`
  - 컨테이너 `/app/uploads`
- TrustStore를 컨테이너에 마운트하는 구성 완료
- 최신 소스 기준 `uninote-backend:latest` 이미지 재빌드 성공
- `docker compose up -d` 실행 완료
- 컨테이너 이름: `uninote-backend`

## 아직 확인하지 않은 항목

- 컨테이너가 실제로 `Up` 상태인지
- Spring Boot `Started BackendApplication` 로그
- Java JDBC의 RDS `VERIFY_IDENTITY` 연결 성공
- Hibernate JPA `ddl-auto: validate` 성공
- 주요 API 응답
- 업로드 파일의 컨테이너 재생성 후 유지

## 현재 가장 중요한 차단 요인

RDS의 `uninote_db`에는 아직 UniNote 테이블이 없다. 따라서 컨테이너 실행 자체가 완료되었더라도 Backend가 Hibernate schema validation 단계에서 `missing table` 오류로 종료될 수 있다.

현재 Backend 정상 기동을 위해서는 다음 순서가 필요하다.

1. 컨테이너 상태와 로그 확인
2. Windows 로컬 MySQL의 UniNote 테이블·데이터·스키마 확인
3. 로컬 DB dump 생성 및 RDS import
4. 업로드 파일을 `/opt/uninote/uploads`로 이전
5. Backend 컨테이너 재기동
6. JPA validation 및 주요 API 검증

## 운영 메모

- `JAVA_TOOL_OPTIONS`의 768MB heap 제한은 t3.small의 초기 운영값으로 적절하지만, AI PDF 처리 중 메모리 사용량을 `docker stats`로 확인해야 한다.
- EC2에 2GB swap과 Docker 로그 로테이션이 필요하다.
- `FILE_SIGNING_SECRET`을 생략하면 JWT secret이 파일 서명 키로 fallback되므로, JWT secret 교체 시 기존 이미지·PDF URL이 깨질 수 있다.
- 현재 Gemini Backend read timeout은 60초이므로 AI 생성 최대 약 90초 요구사항에 맞춰 120초 이상으로 조정해야 한다.
- RDS 데이터 이전 전에는 로컬 Backend를 중지해 dump 중 데이터 변경을 막아야 한다.
