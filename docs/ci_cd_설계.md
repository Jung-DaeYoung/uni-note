# UniNote CI/CD 전환 설계 (사전 분석)

작성일: 2026-11-09 · 기준 브랜치: `feature/note-ai` (`1ac1a86`) · 개정: 2026-11-09 (검토 반영), 2026-11-10 (배포 방식 변경)

> **2026-11-10 배포 방식 변경.** 아래 방식이 이 문서의 OIDC·`AWS-RunShellScript`·`deploy-backend.yml` 설계를 대체한다. 단계 계획은 `docs/current-plan.md`, 결정 근거는 `docs/1109.md` 6절에 있다.
>
> | 항목 | 현재 방식 |
> |---|---|
> | AWS 인증 | IAM User Access Key. GitHub Secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Free Tier SCP가 `iam:*Provider*`를 막아 OIDC Provider를 만들 수 없다 |
> | SSM | 커스텀 문서 `UniNote-Deploy` (파라미터 `ImageTag`), 리전 `ap-southeast-2`, 인스턴스 `i-0bf5c3061e672a073` |
> | 배포 스크립트 | EC2 `/opt/uninote/deploy.sh` (저장소에 없음). 6장 스크립트는 이 스크립트의 설계 참고안이다 |
> | 워크플로 | 기존 `.github/workflows/ci.yml`에 `deploy` job을 추가한다 (`needs: image`, main push에서만) |
> | GHCR | Private. 태그는 `:<github.sha>` 하나. EC2 root가 pull 인증을 마쳤다 |
> | 1·2장 | 작성 당시(CI 도입 전) 분석이다. CI와 GHCR push는 PR #7·#8로 main에 반영됐다 |

## 읽기 전에

- 이 문서는 분석과 설계만 다룬다. 파일 수정, 커밋, 배포, EC2·RDS 접근은 하지 않았다.
- EC2·AWS 상태는 직접 조회하지 않았다. `docs/aws-deployment-guide.md`의 기록을 근거로 했다.
  - 기록이 없는 항목은 **[미확인]**으로 표시했다.
  - 구현 전에 확인해야 하는 항목은 **[확인 필요]**로 표시했다.
- 대상 환경
  - GitHub `Jung-DaeYoung/uni-note`: 운영 브랜치 `main`, 개발 브랜치 `feature/note-ai`, CI/CD 작업 브랜치 `ci/actions`(main에서 분기)
  - Frontend: Netlify 자동 배포
  - Backend: AWS EC2 + Docker Compose + Spring Boot 3.4.2
  - DB: AWS RDS MySQL 8.4.11
  - 예정: GHCR 이미지 저장, AWS SSM 배포(IAM User Access Key), Flyway 검토

### 개정 내역 (2026-11-09)

| 항목 | 변경 |
|---|---|
| SSM 배포 스크립트 | POSIX `sh`로 작성. `pipefail`·`set -e`를 쓰지 않는다. 롤백 후 상태도 검증한다. 스크립트는 저장소 파일을 base64로 전달한다 (6장) |
| 배포 성공 검증 | 403 검증의 한계를 적고, 여러 조건을 함께 보는 검증과 외부 경로 검증을 추가했다. Actuator는 별도 검토 대상이다 (7장) |
| Flyway | RDS 컬럼 상태를 A/B/C로 나누고, baseline 버전 규칙과 적용 순서를 정리했다 (9장) |
| DB 권한 | 앱 계정과 마이그레이션 계정을 나누는 방안을 비교했다 (10장) |
| 이미지 정리 | `prune`만 쓰던 방식을 태그 정리 정책으로 바꿨다. 현재 이미지와 직전 정상 이미지만 남긴다 (11장) |
| CI | `ci/**` 브랜치를 트리거에 추가했다. 실제 npm 스크립트를 확인했다. 배포 스크립트 문법 검사를 추가했다 (6장) |

---

## 1. 현재 구조 분석

### 저장소와 브랜치

- 모노레포 구조다: `backend/`(Gradle), `frontend/`(Vite), `docs/`.
- `.github/`가 없다. 기존 워크플로는 하나도 없다.
- `feature/note-ai`는 `main`보다 30커밋 앞서 있고, 뒤처진 커밋은 없다.
- 원격 `origin`과 `uni`가 같은 URL을 가리킨다. 동작에는 문제가 없다.
- `backend/gradlew`가 Git에 `100644`(실행 권한 없음)로 등록되어 있다. Dockerfile은 `chmod`로 이를 처리한다.

### Backend 빌드와 테스트

- Gradle Wrapper 9.4.1, Java 21 toolchain. 명령은 `./gradlew test`, `./gradlew bootJar`.
- 테스트 클래스는 33개다. 대부분 mock이나 WebMvc 테스트다.
- `BackendApplicationTests`와 `SearchServiceIntegrationTest`는 `@SpringBootTest`라서 **실제 MySQL이 필요하다.**
  - `application.yaml`은 `localhost:3306/uninote_db`, `ddl-auto: update`로 설정되어 있다.
  - `src/test/resources`는 없다.
- 위 두 테스트가 필요로 하는 환경변수
  - `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`(32바이트 이상), `JWT_EXPIRATION`
  - `GEMINI_API_KEY`: `GeminiClient`의 `@PostConstruct`가 빈 값이면 기동을 실패시킨다. 더미 값이면 충분하다.
- Spring Boot가 기동되면 `Started BackendApplication` 로그를 남긴다(메인 클래스 `BackendApplication`). 7장의 배포 검증에 쓴다.

### Frontend 빌드와 테스트

- `frontend/package.json`에 실제로 있는 스크립트
  - `dev`
  - `build`(`vite build`)
  - `lint`(`eslint .`)
  - `preview`
  - `test`(`vitest run`)
- CI에서는 `lint`, `test`, `build`만 쓴다. `npm ci`는 `package-lock.json`이 있어 쓸 수 있다.
- `engines` 필드와 `.nvmrc`가 없다. 로컬 Node는 v24.22.1이다.
  - Netlify 빌드에서 쓰는 Node 버전은 **[확인 필요]**다. Netlify 빌드 로그에서 확인한다.
  - CI는 Netlify와 같은 버전으로 맞춘다.
- `VITE_API_BASE_URL`은 빌드할 때 JS와 CSP에 들어간다(`vite.config.js`). 배포는 계속 Netlify가 하고, Actions는 검증만 한다.
- 2026-11-09 실행 결과
  - `npm run lint`: 오류와 경고가 없었다.
  - `vitest run`: 테스트 파일 23개, 테스트 149개가 모두 통과했다.
  - `npm run build`: `frontend/dist`에 파일을 써서 이번에는 실행하지 않았다.

### `backend/Dockerfile`

- 멀티 스테이지 빌드다. `eclipse-temurin:21-jdk`로 빌드하고 `21-jre`로 실행한다.
- 의존성 층이 캐시된다. `bootJar`만 실행하므로 이미지 빌드 중에는 테스트가 돌지 않는다.
- `.dockerignore`가 `application-local.yaml`, `uploads/`, `build/`를 제외한다. 비밀값은 이미지에 들어가지 않는다.
- `USER`, `HEALTHCHECK`, `TZ`, OCI label은 없다.
- EC2가 t3.small(x86_64)이므로 `linux/amd64`로만 빌드하면 된다.
- 결론: **수정하지 않고 CI에서 그대로 쓸 수 있다.**

### EC2 `docker-compose.yml`과의 호환성 (가이드 STEP 12 기준)

- compose 파일에 `image: uninote-backend:latest`가 고정되어 있다.
- EC2에서 GHCR 이미지를 pull한 뒤 로컬 태그 `uninote-backend:latest`로 다시 붙이면, **compose를 수정하지 않아도 된다.**
- 다음 설정은 모두 그대로 유지된다.
  - `env_file ./backend.env`
  - 포트 `127.0.0.1:8080`
  - `/opt/uninote/uploads` 볼륨
  - truststore `:ro` 마운트
  - 로그 회전
  - Nginx, Certbot

### ⚠️ 배포 전에 꼭 알아야 할 사실

- `c731e49`에는 Enrollment 변경이 들어 있다. `academic_year`·`semester` NOT NULL 컬럼과 unique 키를 추가한다. **이 커밋은 PR #6으로 이미 `main`에 병합됐다** (2026-11-10 `git merge-base`로 확인).
- 운영은 `ddl-auto: validate`다. 컬럼이나 키가 없으면 이 커밋 이후 이미지는 기동에 실패한다.
- **2026-11-10 해소.** 사용자가 운영 RDS를 로컬 DB 덤프(2026-11-10)로 재구축했다. `enrollments`의 `academic_year`·`semester`는 NOT NULL이고, 테이블 20개와 주요 데이터 건수가 로컬과 일치한다 (사용자 보고).
  - 같은 날 main `3074587` 이미지를 `deploy.sh`로 수동 배포했고, 기동과 RDS 연결, Netlify 화면을 확인했다 (사용자 보고).
  - 이 문서는 DB를 자동으로 변경하거나 재초기화하는 방식을 다루지 않는다.
- 백엔드 코드에는 Enrollment를 쓰는 곳이 없다(`new Enrollment`나 `save` 호출이 main과 feature 모두 0건). 수강 데이터는 시드 SQL로만 들어간다.
  - 그래서 컬럼을 먼저 추가해도 기존 이미지가 깨지지 않는다(validate는 남는 컬럼을 무시한다). 9장의 적용 순서는 이 사실을 전제로 한다.

## 2. 자동화 가능 여부

| 항목 | 가능 여부 | 비고 |
|---|---|---|
| Backend 테스트 | 가능 | MySQL 8.4 service container와 더미 환경변수 |
| Frontend lint·test·build | 가능 | lint·test 통과 확인 |
| 이미지 빌드 → GHCR push | 가능 (완료, PR #8) | `GITHUB_TOKEN`만으로 충분 |
| SSM으로 EC2 배포 | 가능 | OIDC는 SCP 제한으로 불가. IAM User Access Key로 `UniNote-Deploy` 실행 (4장) |
| 자동 롤백 | 가능 | `prev` 태그 + 여러 조건 검증 (6·7장) |
| Flyway | 가능하나 별도 단계 | RDS 컬럼 상태를 먼저 확인 (9장) |

## 3. 필요한 변경 사항 (구현 단계에서)

1. `.github/workflows/ci.yml`을 새로 만든다 (완료, PR #7·#8). CD는 같은 파일에 `deploy` job으로 추가한다. `deploy-backend.yml`은 만들지 않는다.
2. 배포 스크립트는 EC2 `/opt/uninote/deploy.sh`에 둔다(root 소유 755). SSM 문서 `UniNote-Deploy`가 이 스크립트를 실행한다. 저장소에는 두지 않는다.
3. (선택) `git update-index --chmod=+x backend/gradlew`. 워크플로에서 `chmod`해도 된다.
4. (선택) Dockerfile에 `LABEL org.opencontainers.image.source=https://github.com/Jung-DaeYoung/uni-note`를 추가한다.
5. GHCR 이미지 이름은 소문자로 쓴다: `ghcr.io/jung-daeyoung/uni-note-backend:<sha>`
6. EC2 쪽 파일(`docker-compose.yml`, `backend.env`, uploads, truststore, Nginx)은 바꾸지 않는다.
7. Flyway는 2단계에서 진행한다 (9·10장).
8. (선택, 별도 검토) Actuator health 엔드포인트 (7장).

## 4. AWS 콘솔에서 직접 설정해야 할 항목

2026-11-10 기준 1~4는 사용자가 완료했다고 보고했다.

1. **IAM User** (`uninote-github-deploy`)와 Access Key
   - OIDC Identity provider는 Free Tier SCP `DenyIAMRestrictedActions`가 `iam:*Provider*`를 막아 만들 수 없다.
   - 권한 (최소)

     | Action | Resource |
     |---|---|
     | `ssm:SendCommand` | `arn:aws:ssm:ap-southeast-2:<계정ID>:document/UniNote-Deploy` 와 `arn:aws:ec2:ap-southeast-2:<계정ID>:instance/i-0bf5c3061e672a073` (둘 다 필요) |
     | `ssm:GetCommandInvocation` | `*` |

   - 커스텀 문서 ARN에는 계정 ID가 들어간다. AWS 관리형 문서(`::document/AWS-…`)와 형식이 다르다.
   - `AWS-RunShellScript`는 허용하지 않는다. 결과 확인에는 위 두 권한이면 충분하다.
2. **SSM Document `UniNote-Deploy`**: 파라미터 `ImageTag`를 받아 `/opt/uninote/deploy.sh <ImageTag>`를 root로 실행한다. 다음은 [확인 필요]다 (`aws ssm get-document --name UniNote-Deploy`).
   - `ImageTag`에 `allowedPattern: ^[0-9a-f]{40}$`가 있는가
   - 스크립트 종료 코드가 그대로 step 상태(`Success`/`Failed`)가 되는가
   - `aws:runShellScript`의 실행 제한 `timeoutSeconds`는 **600초**로 한다. 지정하지 않으면 기본값 3600초라, Actions가 폴링을 멈춘(15분) 뒤에도 EC2에서 스크립트가 계속 돌 수 있다. 새 문서 버전을 만들면 기본 버전으로 지정해야 적용된다
     - **2026-11-10 완료 (사용자 보고).** 버전 2에 `timeoutSeconds: 600`을 넣었고, 버전 2가 기본 버전이다(콘솔 Versions 탭에서 확인).
   - **2026-11-10 SSM 수동 실행 성공 (사용자 보고).** Run Command에서 기본 버전으로 `ImageTag=307458768d792d6bd1c405fa18055d773e3b5e1a`를 실행해 `Success`를 확인했다. ResponseCode는 따로 확인하지 않았다.
3. **SSM Managed Node**: 인스턴스가 `Online`이다 (사용자 보고). EC2 인스턴스 프로파일은 SSM Agent 통신에 필요한 권한을 가져야 한다.
4. **EC2 GHCR 인증**: 패키지가 Private이다. root로 `read:packages` 토큰을 써서 `docker login ghcr.io --password-stdin`을 한 번 했다 (사용자 보고).
5. **RDS 자동 백업과 삭제 방지**. 현재 보류 상태다. Flyway 도입 전에는 필수다.

### EC2에서 확인할 항목 ([확인 필요], 읽기 전용)

```bash
snap services amazon-ssm-agent
sudo snap logs amazon-ssm-agent | tail
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/iam/info   # 404면 Role 없음
docker compose version
sudo docker compose version     # SSM은 root로 실행된다. compose 플러그인이 ubuntu 사용자에게만 설치됐으면 실패한다
command -v curl base64          # 배포 스크립트가 쓰는 도구
df -h /; docker images
```

- 보안 그룹의 아웃바운드 443 허용도 확인해야 한다(SSM, GHCR, STS 접속).

## 5. GitHub Secrets 및 Variables

| 이름 | 종류 | 용도 |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | Repository Secret (등록 완료) | IAM User `uninote-github-deploy` 키 |
| `AWS_SECRET_ACCESS_KEY` | Repository Secret (등록 완료) | 위 키의 비밀 값 |
| `GITHUB_TOKEN` | 자동 제공 | GHCR push (`image` job, `packages: write`) |

- 리전 `ap-southeast-2`와 인스턴스 ID는 비밀 값이 아니다. `image` job의 `IMAGE`처럼 `deploy` job `env`에 둔다.
- Repository Secret은 모든 브랜치의 push 워크플로에서 읽을 수 있다. main 전용 Environment `production`의 Secret으로 옮기고 `deploy` job에 `environment: production`을 지정하기를 권장한다 (사용자 결정).
- Access Key는 장기 키다. 주기적으로 교체하고 CloudTrail로 사용 기록을 확인한다.
- 운영 비밀값(DB, JWT, Gemini, truststore)은 GitHub에 넣지 않는다. 계속 EC2 `backend.env`에만 둔다.
- CI 테스트에 쓰는 DB·JWT 값은 더미 값이다. 워크플로에 직접 적는다.

## 6. Workflow 파일 구성안

### `ci.yml` (현재, PR #7·#8)

| job | needs | 실행 조건 |
|---|---|---|
| `backend` (Backend test) | 없음 | PR·push. MySQL 8.4 service, `./gradlew test`, CI 전용 가짜 env |
| `frontend` (Frontend lint, test, build) | 없음 | PR·push. Node 24, `npm ci → lint → test → build` |
| `image` (Backend image (GHCR)) | `backend`, `frontend` | main push만. 태그 `ghcr.io/jung-daeyoung/uni-note-backend:${{ github.sha }}` |
| `deploy` (구현됨, `ci/cd` 브랜치, main 병합 전) | `image` | main push만 |

- 트리거는 `pull_request: [main]`, `push: [main]`이다. `paths` 필터는 걸지 않는다. 필수 체크로 지정한 job이 실행되지 않으면 PR이 대기 상태로 남는다.

### `deploy` job (구현됨, `ci/cd` 브랜치, main 병합 전)

전문은 `docs/current-plan.md` 5단계에 있다. 설계 요점은 다음과 같다.

- 설정
  - `needs: image`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
  - `concurrency: { group: deploy-prod, cancel-in-progress: false }`. 워크플로 concurrency가 SHA별이라, main push가 연달아 오면 배포가 겹칠 수 있기 때문이다.
  - `permissions: {}`. 이 job은 `GITHUB_TOKEN`을 쓰지 않는다.
  - `env`에 Secrets(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`), `AWS_DEFAULT_REGION`, 인스턴스 ID
- 실행
  1. `aws ssm send-command --document-name UniNote-Deploy --timeout-seconds 120 --parameters '{"ImageTag":["<github.sha>"]}'`. 러너에 AWS CLI가 있어 checkout이나 추가 action이 필요 없다.
     - `--timeout-seconds 120`은 명령이 시작되기까지의 전달 timeout이다. 인스턴스가 오프라인일 때 명령이 오래 대기하다가 나중에 오래된 SHA로 실행되는 일을 막는다. 실행 시간 제한은 SSM 문서의 `timeoutSeconds`(600초)가 정한다.
     - 전달 120초 + 실행 600초 = 720초로, 폴링 15분(900초)과 job `timeout-minutes: 20`보다 짧다. 그래서 Actions가 결과를 기다리는 동안 SSM 명령이 반드시 끝난다.
  2. `aws ssm get-command-invocation`으로 10초마다 최대 15분 폴링한다.
     - `aws ssm wait command-executed`는 쓰지 않는다. 약 100초(5초 × 20회)만 기다리므로, 배포가 길면 EC2에서 배포가 계속되는데 Actions만 실패한다.
     - 명령 직후의 `InvocationDoesNotExist`는 재시도한다.
  3. `Status`와 `ResponseCode`만 출력한다. `Status`가 `Success`가 아니면 job을 실패시킨다.
- `ImageTag` 형식 검증은 SSM 문서의 `allowedPattern`과 `deploy.sh`에서 한다. `github.sha`는 GitHub가 만드는 값이라 워크플로에서 따로 검증하지 않는다.
- 외부 경로 검증(`https://uninote.duckdns.org/api/courses` → 403, 7장)은 최소 구성에서 뺐다. 필요하면 step 하나로 추가한다.
- PR에서는 `image`가 skipped라 `deploy`도 skipped다. fork PR에는 secrets가 전달되지 않는다.

### EC2 배포 스크립트 `/opt/uninote/deploy.sh` (설계 참고안)

- 실제 스크립트는 EC2에만 있고 저장소에는 없다. 아래는 그 스크립트가 지켜야 할 원칙과 참고 구현이다. 실제 내용이 이 원칙을 지키는지는 [확인 필요]다.
- 실제 스크립트에서 알려진 동작 (사용자 보고, 2026-11-10 수동 배포에서 사용)
  - SHA 형식 검증, root 확인, `flock`으로 중복 실행 방지
  - GHCR pull → `uninote-backend:latest`를 `prev`로 보존 → 새 이미지를 `latest`로 → Compose 재시작
  - 헬스체크: `http://127.0.0.1:8080/api/courses`가 200·401·403이면 성공. 참고 구현(403만, 이미지 ID·재시작 횟수 확인)과 다르다. 이번 범위에서는 바꾸지 않는다
  - 실패하면 `prev`로 롤백한다. 실제 종료 코드 체계는 아래 참고 구현과 다를 수 있다 [확인 필요]
- 참고안의 `APP_DIR`, 이미지 이름 등은 EC2 실제 값에 맞춰야 한다.

두 스크립트의 역할과 셸 옵션 (사용자 보고, 내용은 [확인 필요])

| 스크립트 | 위치 | 역할 | 셸 옵션 |
|---|---|---|---|
| SSM 문서 wrapper | `UniNote-Deploy`의 `aws:runShellScript` 명령 | `ImageTag`를 받아 `deploy.sh`를 호출하고, 그 종료 코드를 SSM 결과로 넘긴다 | `set -eu` |
| 배포 스크립트 | EC2 `/opt/uninote/deploy.sh` | pull, 태그 교체, 재기동, 헬스체크, 롤백 | `set -Eeuo pipefail` |

- wrapper는 `aws:runShellScript`가 `sh`(Ubuntu에서는 dash)로 실행한다. `set -eu`이므로 `deploy.sh`가 0이 아닌 값으로 끝나면 wrapper도 그 값으로 끝나고 SSM 결과는 `Failed`가 된다. 단, `|| true`나 파이프(`| tee`)로 호출하면 종료 코드가 가려진다.
- `deploy.sh`의 `-E`와 `-o pipefail`은 bash 옵션이다. 그래서 shebang이 bash여야 하고, wrapper는 `sh /opt/uninote/deploy.sh`가 아니라 실행 파일로 직접 호출해야 한다.
- `deploy.sh`는 `-e`를 쓰므로, 헬스체크·재기동 실패가 롤백 전에 스크립트를 끝내지 않도록 해야 한다. 실패할 수 있는 명령을 `if`·`||`로 감싸거나 `trap ... ERR`로 롤백을 실행한다. `-E`는 함수 안의 오류에도 `ERR` trap이 동작하게 한다.
- `pipefail`에서는 `docker logs ... | grep -q`처럼 앞 명령이 SIGPIPE로 끝나는 파이프가 실패로 판정될 수 있다.

설계 원칙 (아래 참고 구현은 POSIX `sh` 버전이다. 실제 `deploy.sh`는 bash와 `set -Eeuo pipefail`을 쓰므로 원칙만 적용한다)

- 실패하면 반드시 0이 아닌 값으로 끝낸다. 롤백에 성공했어도 배포는 실패이므로 0이 아닌 값으로 끝낸다. SSM은 종료 코드로 `Success`/`Failed`를 정하고, Actions는 이 상태로 성공·실패를 정한다.
- `sh`로 실행하는 스크립트에는 `pipefail`, `[[ ]]`, 배열 같은 bash 문법을 쓰지 않는다. bash로 실행하는 스크립트는 shebang과 SSM 문서의 호출 방식이 일치해야 한다.
- `-e`를 쓰면 실패한 명령에서 스크립트가 바로 끝나 롤백이 실행되지 않을 수 있다. 참고 구현은 `-e` 없이 단계마다 명시적으로 분기한다. `-e`를 쓰는 실제 `deploy.sh`는 위 방법(조건문으로 감싸기 또는 `ERR` trap)으로 롤백 경로를 보장한다.
- 이미지를 교체하기 전에 실패하면(pull이나 tag 실패) 운영에 영향이 없다. 그대로 종료한다.
- 롤백한 뒤에도 같은 기준으로 상태를 검증한다. 롤백까지 실패하면 다른 종료 코드를 남긴다.
- 출력은 결과 줄만 남긴다. 공개 저장소라 Actions 로그가 공개되므로 컨테이너 로그나 환경값은 출력하지 않는다.

```sh
#!/bin/sh
# 사용: sh /opt/uninote/deploy.sh <40자리 commit SHA>
# 종료 코드: 0 성공 / 1 교체 전 실패 또는 배포 실패 후 롤백 성공 / 2 롤백 실패 / 3 복구할 prev 없음
set -u

TAG=${1:-}
APP_DIR=/home/ubuntu/uni-note
REPO=ghcr.io/jung-daeyoung/uni-note-backend
IMG="$REPO:$TAG"
NAME=uninote-backend
LOCAL=uninote-backend

case "$TAG" in ''|*[!0-9a-f]*) echo "BAD_TAG"; exit 1 ;; esac
[ "${#TAG}" -eq 40 ] || { echo "BAD_TAG"; exit 1; }
cd "$APP_DIR" || { echo "NO_APP_DIR"; exit 1; }

image_id() { docker image inspect -f '{{.Id}}' "$1" 2>/dev/null; }

# 기대한 이미지로 떠 있고, 기동 로그가 있고, 403을 응답하고, 재시작하지 않는지 확인한다.
healthy() {
  want=$(image_id "$LOCAL:latest") || return 1
  i=0
  while [ "$i" -lt 36 ]; do                     # 최대 약 3분
    i=$((i + 1)); sleep 5
    [ "$(docker inspect -f '{{.Image}}' "$NAME" 2>/dev/null)" = "$want" ] || continue
    [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = "true" ] || continue
    docker logs "$NAME" 2>&1 | grep -q 'Started BackendApplication' || continue
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8080/api/courses)
    [ "$code" = "403" ] || continue
    r1=$(docker inspect -f '{{.RestartCount}}' "$NAME"); sleep 15
    r2=$(docker inspect -f '{{.RestartCount}}' "$NAME")
    [ "$r1" = "$r2" ] && [ "$(docker inspect -f '{{.State.Running}}' "$NAME")" = "true" ] && return 0
  done
  return 1
}

recreate() { docker compose up -d --no-deps --force-recreate backend >/dev/null 2>&1; }

# 11장 정리 정책: 현재 SHA 태그만 남기고 나머지 GHCR 태그를 떼어 낸다.
# latest·prev가 가리키는 이미지는 로컬 태그가 남아 있어 지워지지 않는다.
cleanup() {
  docker image ls "$REPO" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
    [ "$ref" = "$IMG" ] || docker rmi "$ref" >/dev/null 2>&1 || true
  done
  docker image prune -f >/dev/null 2>&1 || true
}

# 1) 교체 전 단계. 여기서 실패하면 운영 영향 없이 종료한다.
docker pull -q "$IMG" >/dev/null 2>&1 || { echo "PULL_FAILED $TAG"; exit 1; }
new_id=$(image_id "$IMG")
cur_id=$(image_id "$LOCAL:latest" || true)
if [ -n "$cur_id" ] && [ "$cur_id" != "$new_id" ]; then
  docker tag "$LOCAL:latest" "$LOCAL:prev" || { echo "TAG_FAILED"; exit 1; }   # 직전 정상 이미지 보존
fi
docker tag "$IMG" "$LOCAL:latest" || { echo "TAG_FAILED"; exit 1; }

# 2) 교체와 검증
if recreate && healthy; then
  cleanup
  echo "OK $TAG"; exit 0
fi
echo "DEPLOY_FAILED $TAG"

# 3) 롤백과 롤백 검증
image_id "$LOCAL:prev" >/dev/null || { echo "NO_PREV_IMAGE"; exit 3; }
docker tag "$LOCAL:prev" "$LOCAL:latest" || { echo "ROLLBACK_FAILED tag"; exit 2; }
if recreate && healthy; then
  echo "ROLLED_BACK"; exit 1
fi
echo "ROLLBACK_FAILED"; exit 2
```

동작 메모

- 같은 SHA를 다시 배포하면(`cur_id = new_id`) `prev`를 덮어쓰지 않는다. 직전 정상 이미지가 사라지지 않게 하기 위해서다.
- 배포에 실패해 롤백하면 `latest`가 다시 `prev`와 같은 이미지가 된다. 그래서 다음 배포 때 `prev`에는 정상 이미지가 들어간다.
- 롤백한 뒤에는 `cleanup`을 실행하지 않는다. 실패한 이미지를 남겨 두고 SSH로 원인을 조사할 수 있게 한다. 남은 이미지는 다음 성공 배포에서 정리된다.
- 처음 자동 배포할 때는 지금 EC2에서 직접 빌드한 `uninote-backend:latest`가 `prev`가 된다.
- `exit 2`(`ROLLBACK_FAILED`)가 나오면 서비스가 중단된 상태일 수 있다. 워크플로가 실패로 끝나므로, 즉시 SSH로 접속해 10장의 긴급 복구를 실행한다.
- `docker logs | grep -q`는 결과만 판단에 쓰고, 로그 내용은 출력하지 않는다.

## 7. 배포 성공 검증

### 403 검증의 한계

`127.0.0.1:8080/api/courses → 403`으로 알 수 있는 것은 **Tomcat이 응답하고 Spring Security 필터 체인이 동작한다**는 사실까지다.

- 이 요청은 인증 단계에서 거부되므로 DB를 조회하지 않는다.
- 다른 프로세스가 8080을 쓰고 있거나, 이전 컨테이너가 남아 있어도 403이 나올 수 있다. 이미지 ID를 비교하지 않으면 이 경우를 구별하지 못한다.
- 앱이 기동한 뒤 crash loop에 빠져도, 한 번은 403이 나올 수 있다.
- 다음은 403만으로 확인되지 않는다.
  - 런타임 DB 연결 (기동한 뒤 끊겼는지)
  - JWT 서명 키와 Gemini 키가 올바른지
  - Nginx·TLS·DNS 경로

DB에 대해서는 간접 근거가 있다. 운영은 `ddl-auto: validate`라서, 기동할 때 DB에 연결해 스키마를 검사한다. 그래서 **기동에 성공했다면 그 시점에는 DB 연결과 스키마가 정상이었다**고 볼 수 있다.

### 1차 검증 (코드 변경 없음, 6장 `healthy()`에 반영)

| 조건 | 확인하는 것 |
|---|---|
| 컨테이너 이미지 ID = `uninote-backend:latest` ID | 새 이미지가 실제로 실행 중인지 |
| `State.Running = true` | 컨테이너가 살아 있는지 |
| 로그에 `Started BackendApplication` | 기동 완료, 즉 validate 단계에서 DB 연결·스키마 검증을 통과했는지 |
| `127.0.0.1:8080` → 403 | Tomcat과 보안 필터가 동작하는지 |
| 15초 동안 `RestartCount`가 그대로 | crash loop가 아닌지 |
| (Actions, 선택) `https://uninote.duckdns.org/api/courses` → 403 | DNS·Nginx·TLS·프록시 경로. 최소 `deploy` job에는 없다 |

- 외부 경로 검증이 실패하면 앱은 정상이고 Nginx 쪽 문제다. 이때는 자동 롤백하지 않고 워크플로를 실패로 표시만 한다. 롤백해도 해결되지 않는 문제이기 때문이다.

### 2차 검증 후보 (코드 변경 필요, 별도 PR·리뷰)

- **Spring Boot Actuator `/actuator/health`**
  - DB health indicator가 기동 후에도 DB 상태를 반영한다. DB가 끊기면 503을 반환한다.
  - 필요한 변경
    - `build.gradle`에 `spring-boot-starter-actuator` 추가
    - `application.yaml`
      - `management.endpoints.web.exposure.include=health`
      - `management.endpoint.health.show-details=never`
    - `SecurityConfig`에서 `/actuator/health`를 `permitAll`로 연다.
  - 노출 범위
    - Nginx가 `/` 전체를 프록시하므로 외부에서도 접근할 수 있다. 응답은 `{"status":"UP"}`뿐이다.
    - 별도 management 포트를 쓰려면 compose 포트를 추가하거나, 컨테이너 안에 curl이 있어야 한다([확인 필요]). 그래서 지금 조건(compose 보존)에서는 8080에 그대로 두는 것이 현실적이다.
  - 판단
    - 1차 검증으로 배포 실패 대부분을 잡을 수 있다.
    - 런타임 DB 감시가 필요해지면 도입한다.
    - 의존성을 추가하는 일이므로 AGENTS.md 원칙에 따라 따로 결정한다.
- **로그인 API로 DB 왕복 확인**: 권장하지 않는다.
  - 테스트 계정 자격증명을 GitHub에 둬야 한다.
  - 로그인 실패 제한(학번당 15분 5회)을 건드린다.

## 8. 예상되는 위험과 해결책

| 위험 | 해결책 |
|---|---|
| 엔티티 변경(`c731e49`, 이미 main에 있음) 때문에 첫 자동 배포가 validate 실패로 기동 실패 | 해소(2026-11-10). RDS 재구축 후 `3074587`을 수동 배포해 기동을 확인했다(1장, 사용자 보고) |
| wrapper(`sh`, `set -eu`)에서 bash 문법 오류가 나거나, `deploy.sh`(`set -Eeuo pipefail`)가 롤백 전에 종료 | wrapper는 `deploy.sh`를 직접 실행하고, `deploy.sh`는 조건문 또는 `ERR` trap으로 롤백 경로를 보장한다(6장). 스크립트가 EC2에만 있어 CI에서 검사할 수 없으므로 6단계 실패 리허설로 확인한다 |
| `deploy.sh`나 SSM 문서가 실패를 0으로 끝내 Actions가 성공으로 표시 | 문서와 스크립트의 종료 코드 전파를 확인하고, 실패 리허설로 `Failed`가 나오는지 본다 |
| `aws ssm wait`가 약 100초 뒤 실패 | 최대 15분 폴링 루프를 쓴다 (6장) |
| `SendCommand` AccessDenied | 문서 ARN에 계정 ID를 넣고, 인스턴스 ARN도 함께 허용한다 (4장) |
| Access Key 유출 | 문서·인스턴스 단위 최소 권한, 주기적 교체, Environment `production`으로 이동 권장 |
| 롤백까지 실패해 서비스 중단 | `exit 2`로 구분한다. 워크플로 실패를 알림으로 받고 SSH로 긴급 복구한다(10장) |
| 403만 보고 성공으로 오판 | 여러 조건을 함께 보는 검증과 외부 경로 검증(7장) |
| 롤백한 이전 이미지가 새 스키마와 맞지 않음 | expand → contract로 나눈다. Flyway는 기본적으로 미래 버전 마이그레이션을 무시한다 |
| GHCR 이름 대문자로 push 실패 | `jung-daeyoung`으로 소문자 고정 |
| SSM이 root로 실행되어 compose 플러그인이 없거나 상대경로가 틀림 | `sudo docker compose version`을 미리 확인하고, 스크립트에서 `cd`한다 |
| SSM 문서에 임의 명령이 들어감 | `AWS-RunShellScript`를 허용하지 않고, 커스텀 문서의 `ImageTag`에 `allowedPattern`을 둔다 |
| Private GHCR pull 실패 | EC2 root로 `docker login ghcr.io`(완료). 토큰이 만료되면 다시 로그인한다 |
| SHA 이미지가 쌓여 EBS 20GB가 가득 참 | 11장 정리 정책 |
| Repository Secret을 다른 브랜치 워크플로가 읽음 | `deploy`는 main push에서만 실행. 키를 main 전용 Environment `production`으로 옮기기를 권장 |
| Flyway가 기존 RDS를 건드림 | 9장 규칙(baseline 버전 = RDS에 이미 반영된 버전), 스냅샷 먼저 |
| backend만 바뀌어도 Netlify가 빌드되어 크레딧 소모 | 이번 범위 밖. 필요하면 별도로 처리 |
| 서버에서 빌드할 때 메모리 부족 | GHCR pull 방식이라 서버 빌드가 없어지므로 해소된다 |

## 9. RDS 기존 스키마와 Flyway 최초 도입 전략

### 전제

- 저장소에는 전체 스키마 DDL이 없다. 기존 20개 테이블은 Hibernate `update`로 만들어진 뒤 덤프로 RDS에 옮겨졌다.
- MySQL 8.4에는 `ADD COLUMN IF NOT EXISTS`가 없다. 그래서 상태와 상관없이 다시 실행해도 안전한(멱등) V2를 만들기 어렵다. 대신 **RDS 상태를 먼저 확인하고 경우를 나눈다.**
- Flyway는 Spring Boot에서 JPA보다 먼저 실행된다. 같은 기동 과정에서 마이그레이션이 끝난 다음 validate가 실행된다.
- `baseline-on-migrate`는 스키마에 테이블이 있고 `flyway_schema_history`가 없을 때 **한 번만** baseline 행을 기록한다. 그 버전 이하의 마이그레이션은 그 DB에서 실행하지 않는다.

### 상태 확인 ([확인 필요], 읽기 전용)

```sql
SHOW CREATE TABLE enrollments;   -- 컬럼, NULL 허용 여부, uk_enroll_student_course 존재 여부
SELECT COUNT(*) FROM enrollments WHERE academic_year IS NULL OR semester IS NULL;  -- 컬럼이 있을 때만
```

### 경우별 적용 방법

| 경우 | RDS 상태 | V1 (`V1__baseline.sql`) | V2 | `baseline-version` |
|---|---|---|---|---|
| **A** | 두 컬럼 NOT NULL과 unique 키가 **모두 있음** | 현재 RDS 스키마 덤프 (컬럼 포함) | 만들지 않는다. 다음 변경이 V2가 된다 | `1` |
| **B** | 컬럼이 **없음** | 현재 RDS 스키마 덤프 (컬럼 없음) | `V2__enrollment_term.sql` = `docs/database.md`의 DDL (ADD → UPDATE → MODIFY NOT NULL + UNIQUE) | `1` |
| **C** | 일부만 있음 (컬럼만 있고 nullable이거나, unique 키가 없음) | Flyway를 도입하기 전에 **수동으로 A 상태까지 맞춘다**(스냅샷 먼저) | 만들지 않는다 | `1` |

- **경우 A**
  - RDS에서는 V1을 건너뛰고 baseline만 기록한다.
  - CI처럼 빈 DB에서는 V1만 실행되고, 그것으로 끝난다.
- **경우 B**
  - RDS에서는 baseline 1을 기록한 뒤 V2만 실행한다.
  - 빈 DB에서는 V1 다음에 V2를 실행한다. 두 환경이 같은 결과가 된다.
  - V2의 `UPDATE`(기존 수강을 4학년 1학기로)는 NOT NULL로 바꾸기 위해 꼭 필요한 데이터 보정이다. 시드 INSERT는 V2에 넣지 않는다.
  - 대안 B'도 있다. 스냅샷을 찍고 DDL을 손으로 적용해 A로 만든 뒤 진행하는 방법이다. Flyway의 첫 실행이 baseline 기록만 하게 되어 더 단순하다. 다만 운영 RDS를 변경하는 일이므로 사용자가 결정한다.
- **경우 C**
  - 상태가 여러 가지라 V2 하나로 모든 경우를 처리할 수 없다. 그래서 수동으로 정리한다.

### 중복 실행을 막는 규칙

1. **`baseline-version`은 RDS에 이미 반영된 마지막 버전과 같아야 한다.**
   - V1 덤프는 RDS를 마지막으로 수동 변경한 **뒤에**, Flyway를 처음 실행하기 **전에** 받는다.
   - V2 내용이 이미 RDS에 들어간 상태에서 V2 파일을 두려면, `baseline-version: 2`로 맞춰야 V2가 다시 실행되지 않는다. 다만 이 경우는 A로 처리하는 편이 단순하다.
2. baseline이 기록된 뒤에는 V1·V2 파일을 **수정하지 않는다.** 바꾸면 checksum 검증이 실패한다. 수정이 필요하면 새 버전 파일로 만든다.
3. **적용 순서 (경우 B)**
   - ① RDS 스냅샷
   - ② V1과 V2가 들어 있고 엔티티는 **아직 바뀌지 않은** 이미지를 배포한다. 앱이 Enrollment를 쓰지 않으므로 컬럼만 먼저 추가되는 expand 단계가 안전하다.
   - ③ `flyway_schema_history`에 1(baseline)과 2가 기록됐는지 확인한다.
   - ④ `c731e49`가 들어 있는 `feature/note-ai`를 병합하고 배포한다.
   - ②와 ④를 한 번에 배포해도 Flyway가 먼저 실행되므로 동작한다. 하지만 실패했을 때 원인을 나누기 어렵다. 그래서 따로 배포하기를 권한다.
4. **적용 순서 (경우 A·C)**
   - ① (C라면) 수동으로 정리한 뒤 스냅샷
   - ② V1 덤프
   - ③ Flyway 이미지 배포 (baseline만 기록)
   - ④ `feature/note-ai` 병합
   - ③과 ④의 순서는 바꿔도 된다.
   - **2026-11-10 현황:** `c731e49`는 이미 main에 병합됐으므로 위 순서의 ④는 끝난 상태다. 운영 RDS는 두 컬럼이 NOT NULL인 덤프로 재구축됐으므로(1장) 경우 A로 본다. unique 키는 복원에 쓴 덤프에 들어 있었다. Flyway 도입 전에 RDS에서 `SHOW CREATE TABLE enrollments;`로 한 번 더 확인한다.
5. 로컬과 CI 기본 프로필은 `spring.flyway.enabled: false`, `ddl-auto: update`를 유지한다. Flyway는 `application-prod.yaml`에서만 켠다.
6. CI에 Flyway 검증 job을 추가한다. 빈 MySQL 8.4에서 Flyway를 켜고 `ddl-auto: validate`로 `contextLoads`를 실행해, V1(+V2)과 엔티티가 일치하는지 확인한다.
   - Boot 3.4.2가 관리하는 Flyway 10.x가 MySQL 8.4를 정식으로 지원하는지는 [확인 필요]다. 이 job에서 경고 수준인지 실패하는지 확인한다.
7. V1 덤프 방법: `mysqldump --no-data --skip-add-drop-table --set-gtid-purged=OFF uninote_db`로 받고 `AUTO_INCREMENT=` 값을 지운다. 덤프는 읽기 전용 작업이다.

MySQL DDL은 트랜잭션으로 되돌릴 수 없다. 그래서 마이그레이션이 포함된 배포 전에는 RDS 스냅샷이 필수다. Community 판에는 undo가 없으므로, 문제가 생기면 수정용 마이그레이션을 새로 추가한다.

## 10. DB 권한: 앱 계정과 마이그레이션 계정

### 현재 상태

- 앱이 어떤 계정을 쓰는지 [미확인]이다. RDS 마스터 계정일 수도 있고, 앱 전용 계정일 수도 있다. 권한도 [미확인]이다.
- 확인 방법: 앱 계정으로 접속해 `SELECT CURRENT_USER(); SHOW GRANTS;`를 실행한다(읽기 전용).

### 필요한 권한

| 계정 | 권한 (`uninote_db.*`) |
|---|---|
| 앱 계정 (예: `uninote_app`) | `SELECT, INSERT, UPDATE, DELETE` |
| 마이그레이션 계정 (예: `uninote_migrator`) | 위 권한 + `CREATE, ALTER, DROP, INDEX, REFERENCES` |

### 방안 비교

| 방안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| ① 단일 계정 | 지금 계정에 DDL 권한을 주고 Spring 내장 Flyway를 쓴다 | 가장 단순하다. 추가 설정이 없다 | SQL injection이 생기면 DDL까지 실행될 수 있다. 마스터 계정이라면 위험이 더 크다 |
| ② Spring 내장 + 계정 분리 | datasource는 앱 계정, `spring.flyway.user/password`는 마이그레이션 계정 | 코드 변경이 설정 두 줄뿐이다. 런타임 SQL은 DML 권한만 가진다 | 두 자격증명이 모두 같은 컨테이너 환경변수에 있다. RCE 수준의 침해는 막지 못한다 |
| ③ 마이그레이션 단독 실행 | SSM 스크립트에서 앱을 교체하기 전에 별도 컨테이너(Flyway CLI)로 migrate한다 | 앱 컨테이너에는 마이그레이션 자격증명이 아예 없다 | EC2에 새 env 파일이 필요하다. CLI에 truststore 설정을 다시 해야 하고, 외부 이미지가 늘어난다 |

### 권장

- **7단계 첫 도입은 ②로 한다.**
  - 다만 마이그레이션 계정 생성(RDS)과 `backend.env`에 `FLYWAY_USER`·`FLYWAY_PASSWORD` 추가(EC2)는 운영 설정을 바꾸는 일이다. 그래서 **사용자가 직접 수행**한다.
  - 지금 앱이 마스터 계정을 쓰고 있다면, 앱 전용 DML 계정으로 바꾸는 일을 먼저 한다. 이것만으로도 위험이 크게 줄어든다.
- ③은 스키마 변경이 잦아지거나 보안 요구가 높아지면 검토한다.
- 마이그레이션 계정은 RDS 마스터 계정과 다른 계정으로 만든다.

## 11. Docker 이미지 정리 정책

### 문제

- `docker image prune`은 **태그가 없는 이미지(dangling)만** 지운다.
- `ghcr.io/...:<sha>` 태그가 붙은 이미지는 배포할 때마다 그대로 쌓인다. 그래서 `prune`만으로는 보관 개수가 줄지 않는다.

### 정책

| 보존 대상 | 방법 |
|---|---|
| 현재 실행 중인 이미지 | `uninote-backend:latest` + `ghcr...:<현재 SHA>` |
| 직전 정상 이미지 | `uninote-backend:prev` (로컬 태그) |
| 그 외 | GHCR SHA 태그를 떼어 낸다. 다른 태그가 남지 않은 이미지는 삭제되고, 남은 dangling 이미지는 `prune`이 정리한다 |

- 6장의 `cleanup()`이 이 정책을 구현한다. 원리는 다음과 같다.
  - `docker rmi <태그>`는 같은 이미지에 다른 태그가 남아 있으면 **태그만 떼어 낸다.** 그래서 latest·prev가 가리키는 이미지는 그대로 남는다.
  - 두 단계 이전 이미지는 더 이상 태그가 없어서 삭제된다.
  - 실행 중인 컨테이너가 쓰는 이미지는 삭제되지 않고 오류가 난다. 이 오류는 무시한다(`|| true`).
- `cleanup()`은 **배포에 성공했을 때만** 실행한다. 롤백한 경우에는 실패한 이미지를 남겨 두고 조사한다.
- 결과적으로 EC2에는 이미지가 최대 2~3개(현재, 직전, 조사 중인 실패 이미지)만 남는다.
- 더 이전 버전으로 수동 롤백할 때는 GHCR에서 다시 pull하면 된다. 패키지가 Private이라 GHCR 저장 한도와 과금은 [미확인]이다(`1109.md` 12절). GHCR 정리는 필요할 때 따로 검토한다.
- `eclipse-temurin` 같은 빌드 기반 이미지는 EC2에서 빌드를 멈춘 뒤 한 번만 수동으로 정리한다. 자동 정리 대상에는 넣지 않는다.

## 12. 배포 실패 시 이전 Docker 이미지로 복구하는 방법

- **자동**: 6장 스크립트가 검증에 실패하면 `prev`로 되돌리고 같은 기준으로 다시 검증한다(`ROLLED_BACK`, exit 1).
- **수동**: SSM 콘솔이나 CLI로 `UniNote-Deploy`를 실행하고 `ImageTag`에 이전 SHA를 넣는다. 그 SHA 이미지를 pull한 뒤 같은 스크립트로 교체하고 검증한다. 워크플로 `workflow_dispatch`는 이번 범위에 넣지 않았다.
- **긴급** (롤백도 실패해 `ROLLBACK_FAILED`가 나왔을 때, EC2에서 직접)

  ```bash
  cd ~/uni-note
  docker images uninote-backend            # prev 존재 확인
  docker tag uninote-backend:prev uninote-backend:latest
  docker compose up -d --no-deps --force-recreate backend
  docker compose logs --tail=100 backend   # 원인 확인 (SSH 화면에서만, 공개 로그에 남기지 않는다)
  ```

- **DB**: 마이그레이션 때문에 문제가 생겼다면 이미지 롤백만으로는 복구되지 않을 수 있다. 배포 전에 만든 RDS 스냅샷에서 복원할지는 데이터 손실 범위를 확인한 뒤 결정한다.
