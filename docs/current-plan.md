# 2026-11-07 배포환경 구축 오늘 작업 계획

> `docs/1106.md`는 저장소에 없어 최신 진행 문서인 `docs/1107.md`와 `docs/배포환경 설계.md`를 기준으로 작성한다.

## 목표

EC2에서 RDS를 인증서 검증 방식으로 연결하고, 기존 로컬 데이터와 업로드 파일을 이전한 뒤 Backend 컨테이너를 `validate` 설정으로 기동한다. 이후 Nginx·HTTPS·Netlify 연동으로 넘어갈 수 있는 상태까지 만든다.

## 현재 단계 갱신 (2026-11-07 13:15)

- `~/uni-note/backend.env`와 RDS CA 기반 `rds-truststore.p12` 준비 완료
- 2GB EC2 대응 Compose 작성 완료
  - JVM `-Xms256m -Xmx768m`
  - `127.0.0.1:8080:8080`
  - `/opt/uninote/uploads:/app/uploads`
  - TrustStore 마운트
- 최신 Backend 이미지 재빌드 완료
- `docker compose up -d` 실행 완료
- 아직 컨테이너 로그·JPA `validate`·실제 API 응답은 검증하지 않음
- RDS `uninote_db`에 테이블이 없으므로 컨테이너가 schema validation에서 실패할 수 있음

## 다음 작업 우선순위

1. 컨테이너 상태와 로그를 확인해 SSL 연결, 환경변수, `missing table` 원인을 구분한다.
2. Windows 로컬 MySQL을 읽기 전용으로 점검한다.
3. 로컬 테이블·데이터·업로드 파일을 확인한 뒤 dump/import한다.
4. Backend를 재기동하고 JPA `validate`와 주요 API를 확인한다.
5. 업로드 후 컨테이너 재생성으로 bind mount 영속성을 확인한다.
6. 이후 Nginx → HTTPS → Netlify 연동으로 진행한다.

## 오늘 작업 전 필수 확인

- 실제 RDS endpoint는 `uninote-db.cz2mg06mm9bk.ap-southeast-2.rds.amazonaws.com`을 사용한다. 이전 `c22mg06mm9bk` 오타는 모든 설정과 기록에서 제거한다.
- 운영 env 경로는 `~/uni-note/backend.env`로 통일하고 권한 600을 유지한다.
- `TRUSTSTORE_PASSWORD`, `TZ`, `FILE_SIGNING_SECRET`을 포함한 운영 환경변수 전체를 확인한다.
- `FILE_SIGNING_SECRET`을 생략하면 JWT secret이 파일 서명 키로 사용되므로 JWT 교체 시 기존 이미지·PDF가 깨질 수 있음을 확인한다.
- 현재 Gemini RestTemplate read timeout은 60초이므로 AI 생성 최대 약 90초를 수용하도록 120초 이상으로 조정한다.

## 실행 순서

1. **RDS 운영 설정 확인**
   - `@@global.time_zone`, `require_secure_transport`, `uninote_db` 문자셋을 확인한다.
   - DB가 없으면 `utf8mb4`로 생성하고, 앱 전용 계정과 권한을 준비한다.
   - 시간대가 UTC이면 RDS 파라미터 그룹을 `Asia/Seoul`로 조정하고 필요한 경우 재부팅한다.
   - 완료 기준: EC2에서 RDS에 `VERIFY_IDENTITY`로 접속되고 DB·문자셋·시간대가 확인된다.

2. **로컬 데이터와 업로드 파일 이전**
   - 로컬 Backend를 중지한 뒤 `mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF`로 스키마와 데이터를 덤프한다.
   - 덤프에서 참조하는 파일과 `backend/uploads`의 누락 파일을 확인한다.
   - 덤프와 업로드 파일을 EC2로 전송하고 RDS와 `/opt/uninote/uploads`에 반영한다.
   - 테이블별 행 수와 `notes.created_at`을 로컬·RDS에서 비교한 뒤 임시 덤프를 삭제한다.
   - 완료 기준: RDS에 데이터가 존재하고 업로드 파일이 영속 경로에 있다.

3. **Java용 RDS truststore 생성**
   - `global-bundle.pem`을 인증서별로 분리해 PKCS12 truststore를 만든다.
   - `TRUSTSTORE_PASSWORD`를 `backend.env`에 추가하고 `chmod 600`을 유지한다.
   - 번들의 모든 인증서를 등록하고 TrustStore 파일만 컨테이너에 read-only로 마운트한다.
   - 완료 기준: truststore의 trusted certificate 수가 PEM 인증서 수와 일치한다.

4. **JDBC TLS 검증 설정 적용**
   - `sslMode=VERIFY_IDENTITY`, `trustCertificateKeyStoreUrl=file:/run/secrets/rds-truststore.p12`, PKCS12 타입을 사용한다.
   - `allowPublicKeyRetrieval=false`를 유지하고 JVM 전체 TrustStore는 교체하지 않는다.
   - `DB_HOST`는 RDS 엔드포인트 호스트명을 사용한다.
   - 설정 적용 위치는 `application-prod.yaml` 또는 `SPRING_DATASOURCE_URL` 중 하나로 정하고 중복 설정하지 않는다.
   - 완료 기준: 정상 호스트로 기동되고, 일부러 RDS IP를 사용하면 인증서 검증 실패가 발생한다.

5. **Docker Compose 및 Backend 기동 (진행 중)**
   - `/opt/uninote/docker-compose.yml`에 이미지, `backend.env`, `uploads`, read-only truststore, `127.0.0.1:8080` 바인딩, 로그 로테이션을 설정한다.
   - `restart: unless-stopped`와 Git SHA 이미지 태그를 사용한다.
   - 최신 이미지 재빌드와 `docker compose up -d`까지 완료했다.
   - `docker compose up -d` 후 `docker compose logs`에서 `Started BackendApplication`과 JPA `validate` 성공을 확인한다.
   - `curl 127.0.0.1:8080`으로 외부 공개 없이 Backend 응답을 확인한다.

6. **오늘 작업 종료 점검**
   - 컨테이너 재시작 후 업로드 파일이 유지되는지 확인한다.
   - DB·JWT·파일 서명·Gemini 키가 Git 또는 Docker 이미지에 포함되지 않았는지 확인한다.
   - 미완료 시 다음 작업은 Nginx 설정 → DuckDNS → Certbot HTTPS → Netlify 배포 순서로 진행한다.

## 작업 후 남은 배포 단계

- Nginx의 `client_max_body_size 11m`, `proxy_read_timeout 120s` 적용
- DuckDNS를 Elastic IP에 연결하고 Certbot HTTPS 설정
- Netlify `VITE_API_BASE_URL=https://uninote.duckdns.org` 설정 및 재배포
- 로그인, JWT, CORS, 업로드, 기존 파일, 자동 저장, AI 퀴즈, 쓰기 동작 전체 점검
- RDS 백업·삭제 방지와 EBS 스냅샷 자동화 확인

---

# 노출된 비밀값 대응 + 로그인 보안 정리 (PLANS.md 1순위 2·3번)

## 점검 결과 (2026-10-17)

- 원격 저장소 `github.com/Jung-DaeYoung/uni-note`는 **공개**다. 첫 커밋 `764c07f`(origin/main에 포함)의 `application.yaml`에 DB 사용자명·비밀번호와 JWT secret 문자열이 있다.
- 해시로 비교하면 세 값 모두 **지금 로컬 설정에서 그대로 쓰는 값**이다. 외부 테스트 환경(ngrok + `local` 프로필)에서도 이 JWT secret이 쓰이므로, 누구나 임의 학번의 JWT를 만들 수 있다. 계정 탈취가 가능한 상태다.
- Gemini API 키는 이력에 없다. 코드에서 이름만 참조한다.
- MySQL이 `0.0.0.0:3306`으로 모든 인터페이스에서 대기한다. 같은 네트워크에서 노출된 계정으로 접속을 시도할 수 있다.
- 파일 서명(`FileAccessSigner`)도 JWT secret을 키로 쓴다. 서명된 URL이 노트 본문에 저장되므로, JWT secret만 바꾸면 기존 노트의 이미지와 PDF가 모두 깨진다.

## 코드 변경

1. **파일 서명 키 분리:** `FileAccessSigner`는 `file.signing-secret`을 쓴다. 이 값이 없으면 `jwt.secret`을 쓴다.
   - JWT secret을 바꿀 때 `FILE_SIGNING_SECRET`을 이전 값으로 두면 저장된 URL이 그대로 동작한다.
   - 파일명이 UUID라 서명 키를 알아도 URL을 모르면 파일을 열 수 없다. 그래서 위험이 낮다고 보고, 파일 키 교체는 P0-2 재설계(응답 시 서명) 때 한다.
2. **서명 비교:** 서명 비교를 상수 시간 비교(`MessageDigest.isEqual`)로 바꾼다.
3. **로그인 실패 메시지 통일:** 학번이 없을 때와 비밀번호가 틀릴 때 모두 "학번 또는 비밀번호가 올바르지 않습니다."를 보낸다. 상태 코드는 기존처럼 401이다.
   - 없는 학번일 때도 더미 해시로 BCrypt 비교를 한 번 해서, 응답 시간으로 계정이 있는지 짐작하지 못하게 한다.
4. **로그인 시도 제한:** 같은 학번으로 15분 안에 5번 실패하면 15분 동안 429(`TOO_MANY_REQUESTS`)와 남은 시간을 안내한다.
   - 없는 학번에도 똑같이 적용한다(계정 존재 여부를 숨기기 위해).
   - 로그인에 성공하면 실패 기록을 지운다.
   - 서버 메모리 기준이다. 추적하는 학번이 너무 많아지면 만료된 기록을 지운다.
5. 설정 예시(`application.yaml`, `application-local.yaml.example`)에 `file.signing-secret` 설명을 추가한다.

## 비밀값 교체 (운영 조치)

- **로컬 `application-local.yaml`** (gitignore 대상):
  - `jwt.secret`을 새 임의 값으로 바꾸고, `file.signing-secret`에 이전 값을 넣는다.
  - 새 값은 스크립트로 만들어 바로 파일에 쓴다. 화면과 로그에는 출력하지 않는다.
- **사용자가 직접 할 일:**
  - Windows 사용자 환경 변수 `JWT_SECRET`과 다른 배포 환경의 `JWT_SECRET`을 교체하고, `FILE_SIGNING_SECRET`에 이전 값을 넣는다.
  - MySQL 계정 비밀번호를 바꾼다(`ALTER USER`). 그 뒤 `DB_PASSWORD` 환경 변수와 로컬 설정을 고친다.
  - MySQL `bind-address=127.0.0.1`을 검토한다.
  - JWT를 바꾸면 기존 로그인이 모두 풀린다. 다시 로그인하면 된다.
  - 공개 이력은 값을 교체하면 무력해지므로 이력 재작성은 선택 사항이다.

## 검증

- **`AuthServiceTest`:** 메시지 통일, 없는 학번의 더미 비교, 5회 실패 후 429, 성공 시 초기화, 시간이 지나면 해제
- **`FileAccessSignerTest`:** 별도 키, 이전 키로 만든 서명 호환
- **명령:** `backend\gradlew.bat test`, `npm run lint`, `npm run build`, `npm run test`(프론트는 바뀌지 않음)
- **실제 앱:**
  - 교체 후 로그인
  - 기존 노트의 이미지가 보이는지
  - 이전 secret으로 만든 JWT가 거부되는지
  - 틀린 비밀번호 6회 시 429가 나오는지
