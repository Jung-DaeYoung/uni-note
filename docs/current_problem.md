# AWS 배포 사전 점검: 환경변수 · 업로드 경로 · RDS SSL · DB 마이그레이션

2026-11-06 기준 코드와 로컬 DB를 조회해 확인한 결과다. 코드 수정·배포는 하지 않았고 민감한 값은 기록하지 않았다. `docs/배포환경 설계.md`와 대조해 확인·보강한 내용이다.

표기: **[확인]** 코드·실행 결과로 확인한 사실 · **[추론]** 동작 원리에서 끌어낸 판단(배포 후 확인 필요) · **[확인 필요]** AWS 등 외부 사실이라 콘솔·문서로 확인해야 하는 것

---

## 1. 환경변수

| 변수 | 읽는 위치 | 비고 |
|---|---|---|
| `SPRING_PROFILES_ACTIVE=prod` | `application-prod.yaml` | 이 값이 있어야 운영 설정이 적용됨 |
| `DB_HOST` | `application-prod.yaml` datasource url | 기본값 없음. 없으면 기동 실패 |
| `DB_PORT` | 같은 곳 | 기본 3306 |
| `DB_NAME` | 같은 곳 | 기본 `uninote_db` |
| `DB_USERNAME`, `DB_PASSWORD` | `application.yaml` | 필수 |
| `JWT_SECRET` | `application.yaml` → `JwtUtil.java:19` | 필수, 32바이트 이상 |
| `JWT_EXPIRATION` | 같은 곳 | 필수. 로컬 값은 86400000 |
| `FILE_SIGNING_SECRET` | `application.yaml` → `FileAccessSigner.java:24` | 없으면 `jwt.secret`을 대신 씀 |
| `CORS_ALLOWED_ORIGINS` | `application-prod.yaml` → `SecurityConfig.java:35` | 비어 있거나 localhost가 들어 있으면 기동 실패 |
| `GEMINI_API_KEY` | `GeminiClient.java:29` | 아래 참고 |
| `TZ=Asia/Seoul` | JVM | 코드에서 직접 읽지는 않지만 문서대로 필요 |

- **[확인]** `GEMINI_API_KEY`만 Spring 설정을 거치지 않고 `System.getenv()`로 직접 읽는다. 그래서 yaml이나 `-D` 옵션으로는 넣을 수 없고 실제 OS 환경변수로만 들어간다. `docker --env-file`은 OS 환경변수로 넣으므로 문제없다. 값이 없으면 `@PostConstruct`에서 기동이 실패한다.
- **[확인]** 로컬 `application-local.yaml`에는 `file.signing-secret`이 `jwt.secret`과 별도로 지정되어 있다(이전 JWT secret). 운영의 `FILE_SIGNING_SECRET`에는 **이 로컬 값을 그대로** 넣어야 한다. 서명된 파일 URL이 노트 본문에 저장되기 때문이다.
- **[추론]** `JWT_SECRET`은 새 값을 써도 된다. 기존 토큰만 무효가 되어 사용자가 다시 로그인하면 된다.

## 2. 파일 업로드 저장 경로

- **[확인]** 저장 경로는 상대 경로 `"uploads"`이고, 프로세스가 실행된 디렉터리를 기준으로 정해진다. 이 경로를 쓰는 곳은 두 군데다.
  - `ImageUploadController.java:47, 49, 197`: 저장과 조회
  - `QuizAiGenerationService.java:312`: AI 퀴즈 생성 때 첨부 파일을 읽음
- **[확인]** Dockerfile은 `WORKDIR /app`이고 실행은 `java -jar /app/app.jar`이므로 컨테이너 안의 실제 경로는 **`/app/uploads`** 다. `USER` 지시자가 없어 root로 실행되므로 마운트 권한 문제도 없다.
- 볼륨 마운트는 다음과 같다. `docker run`에 `-w` 옵션을 주면 경로가 바뀌므로 넣지 않는다.
  ```
  -v /opt/uninote/uploads:/app/uploads
  ```
- **[확인]** 로컬 `backend/uploads`는 현재 **비어 있다(0개).** DB의 `notes`, `posts`, `quiz_sets.source_notes`, `shared_note_snapshots`에서도 업로드 URL 참조가 **0건**이다. `legacy-allowed-files`에 있는 3개 파일도 디스크와 DB 어디에도 없다. 지금 시점에는 옮길 파일이 사실상 없지만, 덤프 직전에 문서의 누락 파일 점검 스크립트는 한 번 실행해 둔다.

## 3. RDS SSL (VERIFY_IDENTITY)

- **[확인]** 실제로 쓰이는 드라이버는 `mysql-connector-j` **9.1.0**이다. Spring Boot 3.4.2가 관리하는 버전이며 `gradlew dependencyInsight`로 확인했다.
- **[확인]** 현재 운영 url은 `useSSL=true&requireSSL=true`이다. Connector/J 8.0.13 이후로 이 옵션은 `sslMode=REQUIRED`로 해석되어, **암호화만 하고 서버 인증서는 검증하지 않는다.**

### 적용 방법 (제안, 미반영)

① EC2에서 RDS CA 번들로 PKCS12 truststore를 만든다. 비밀번호는 화면과 프로세스 인자에 남지 않게 입력한다.

```bash
sudo mkdir -p /home/ubuntu/rds-certs && cd /home/ubuntu/rds-certs
sudo curl -fsSLo rds-bundle.pem https://truststore.pki.rds.amazonaws.com/ap-southeast-2/ap-southeast-2-bundle.pem
# keytool은 PEM 파일에서 첫 인증서만 가져오므로 인증서별로 나눈다
sudo awk '/BEGIN CERT/{n++} {print > ("rds-ca-" n ".pem")}' rds-bundle.pem
read -rs TSPW; export TSPW
for f in rds-ca-*.pem; do
  sudo -E docker run --rm -e TSPW -v /home/ubuntu/rds-certs:/certs eclipse-temurin:21-jre \
    keytool -importcert -noprompt -alias "${f%.pem}" -file "/certs/$f" \
    -keystore /certs/rds-truststore.p12 -storetype PKCS12 -storepass:env TSPW
done
sudo -E docker run --rm -e TSPW -v /home/ubuntu/rds-certs:/certs eclipse-temurin:21-jre \
  keytool -list -keystore /certs/rds-truststore.p12 -storepass:env TSPW | grep -c trustedCertEntry
```

[확인 필요] 번들 URL은 AWS 문서의 형식이니 다운로드할 때 확인한다. `global/global-bundle.pem`을 써도 된다.

② `application-prod.yaml`의 url을 이렇게 바꾼다(`useSSL`, `requireSSL`은 제거).

```
jdbc:mysql://${DB_HOST}:${DB_PORT:3306}/${DB_NAME:uninote_db}?serverTimezone=Asia/Seoul&sslMode=VERIFY_IDENTITY&trustCertificateKeyStoreUrl=file:/run/secrets/rds-truststore.p12&trustCertificateKeyStoreType=PKCS12&trustCertificateKeyStorePassword=${TRUSTSTORE_PASSWORD}&allowPublicKeyRetrieval=false
```

③ `backend.env`에 `TRUSTSTORE_PASSWORD`를 추가하고, `docker run`에 `-v /home/ubuntu/rds-certs/rds-truststore.p12:/run/secrets/rds-truststore.p12:ro`를 추가한다.

### 주의할 점

- **[확인]** `DB_HOST`에는 RDS 엔드포인트 호스트명(`*.rds.amazonaws.com`)을 그대로 넣어야 한다. IP나 별칭(CNAME)을 쓰면 VERIFY_IDENTITY의 호스트명 검증에서 실패한다.
- **[추론]** truststore를 `-Djavax.net.ssl.trustStore`로 JVM 전체에 걸면 안 된다. 기본 cacerts를 대체해 버려서 Gemini(googleapis) HTTPS 호출이 실패한다. 위처럼 JDBC 옵션으로만 지정한다.
- 코드를 바꾸지 않는 대안도 있다. `backend.env`에 `SPRING_DATASOURCE_URL=<위 url>`을 넣으면 yaml보다 우선 적용된다. 다만 설정이 두 곳으로 나뉘므로 yaml 수정을 권장한다.
- CLI로 덤프를 넣을 때도 검증을 켠다: `mysql --ssl-mode=VERIFY_IDENTITY --ssl-ca=/home/ubuntu/rds-certs/rds-bundle.pem ...`

## 4. DB 마이그레이션

### [확인] 로컬 DB 현황

- MySQL 8.0.45, DB 문자셋 `utf8mb4` / `utf8mb4_0900_ai_ci`, 테이블 20개.
- 프로시저, 트리거, 뷰가 모두 0개라 DEFINER 문제는 없다.
- 엔티티가 없는 테이블이 하나 있다: `boards` (0행). `comment`는 `@Table`이 없는 `Comment` 엔티티의 기본 테이블명이다. `validate`는 엔티티에 없는 테이블을 검사하지 않으므로 그대로 옮겨도 무방하다.

### ⚠ 문서에 없던 위험: 시간대 [추론, 배포 후 확인 필요]

- `notes.created_at` 하나만 `TIMESTAMP` 타입이고 나머지 12개는 `DATETIME`이다.
- 로컬 DB 세션 시간대는 SYSTEM(KST)인데 RDS 기본값은 UTC다. mysqldump는 TIMESTAMP를 UTC로 내보내므로, RDS가 UTC 세션이면 기존 노트의 생성 시각이 **9시간 이르게** 보이게 된다.
- 해결책은 **RDS 커스텀 파라미터 그룹에서 `time_zone = Asia/Seoul`** 로 설정하는 것이다. 기본 파라미터 그룹은 수정할 수 없으니 새로 만들어 RDS 생성 시 지정한다. 컨테이너의 `TZ`는 JVM 설정일 뿐이라 이 문제를 해결하지 못한다.

### 절차 (`docs/배포환경 설계.md` 12장 3단계 보강)

1. RDS 생성: MySQL 8.4, 위 파라미터 그룹 적용, 퍼블릭 액세스 끔.
2. EC2에서 DB를 만들고, 권장 사항으로 앱 전용 계정을 둔다.
   ```sql
   CREATE DATABASE uninote_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER '<app_user>'@'%' IDENTIFIED BY '<pw>' REQUIRE SSL;
   GRANT SELECT, INSERT, UPDATE, DELETE ON uninote_db.* TO '<app_user>'@'%';
   ```
   운영은 `ddl-auto: validate`라서 DDL 권한이 없어도 된다. 스키마 변경 SQL은 admin 계정으로 적용한다.
3. 로컬 백엔드를 중지한 뒤 덤프한다. 문서의 명령 그대로이며, 덤프 파일은 저장소 밖에 저장한다.
   ```powershell
   mysqldump -u <user> -p --single-transaction --no-tablespaces --set-gtid-purged=OFF `
     --default-character-set=utf8mb4 --result-file="$HOME\uninote.sql" uninote_db
   ```
4. scp로 EC2에 옮긴 뒤 가져온다.
   ```bash
   mysql --ssl-mode=VERIFY_IDENTITY --ssl-ca=/home/ubuntu/rds-certs/rds-bundle.pem \
     --default-character-set=utf8mb4 -h <RDS endpoint> -u <admin> -p uninote_db < ~/uninote.sql
   ```
5. 검증:
   - 테이블별 `SELECT COUNT(*)`를 로컬과 비교한다. `information_schema.table_rows`는 추정치라 쓰면 안 된다. 로컬 기준값: students 7, notes 10, questions 46, user_answers 54, quiz_attempts 23 등.
   - `SELECT id, created_at FROM notes LIMIT 3;`로 시간이 로컬과 같은지 확인한다.
   - 앱이 `validate`를 통과해 기동되는지 확인한다.
   - 로그인, 노트 저장, 퀴즈 생성처럼 쓰기 동작까지 확인한다.
6. 덤프에는 비밀번호 해시가 들어 있으므로 로컬과 EC2의 덤프 파일을 모두 삭제한다.

**[확인 필요]** RDS MySQL 8.4는 `mysql_native_password`가 기본으로 꺼져 있고 `caching_sha2_password`를 쓴다. TLS 연결에서는 `allowPublicKeyRetrieval=false`여도 인증이 되므로 현재 설정으로 문제는 없을 것으로 본다. 첫 접속 때 확인한다.

---

## 요약

실제로 반영할 변경은 두 가지다.

1. `application-prod.yaml`의 SSL url 변경과 인증서 마운트
2. RDS 파라미터 그룹의 `time_zone` 설정

나머지는 현재 코드와 `docs/배포환경 설계.md` 그대로 진행해도 된다.
