# UniNote CI/CD 전환 설계 (사전 분석)

작성일: 2026-11-09 · 기준 브랜치: `feature/note-ai` (`1ac1a86`) · 개정: 2026-11-09 (검토 반영)

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
  - 예정: GHCR 이미지 저장, AWS OIDC + SSM 배포, Flyway 검토

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

- `feature/note-ai`의 `c731e49`에는 Enrollment 변경이 들어 있다. `academic_year`·`semester` NOT NULL 컬럼과 unique 키를 추가한다. 이 커밋은 아직 `main`에 없다.
- 운영은 `ddl-auto: validate`다. RDS에 스키마를 먼저 맞추지 않으면 **병합 후 첫 배포에서 기동이 실패한다.**
- RDS의 실제 상태는 **[확인 필요]**다. 대응 방법은 9장에 있다.
- 백엔드 코드에는 Enrollment를 쓰는 곳이 없다(`new Enrollment`나 `save` 호출이 main과 feature 모두 0건). 수강 데이터는 시드 SQL로만 들어간다.
  - 그래서 컬럼을 먼저 추가해도 기존 이미지가 깨지지 않는다(validate는 남는 컬럼을 무시한다). 9장의 적용 순서는 이 사실을 전제로 한다.

## 2. 자동화 가능 여부

| 항목 | 가능 여부 | 비고 |
|---|---|---|
| Backend 테스트 | 가능 | MySQL 8.4 service container와 더미 환경변수 |
| Frontend lint·test·build | 가능 | lint·test 통과 확인 |
| 이미지 빌드 → GHCR push | 가능 | `GITHUB_TOKEN`만으로 충분 |
| OIDC → SSM으로 EC2 배포 | 조건부 | IAM·SSM Agent·root의 compose 사용 가능 여부가 [미확인] (4장) |
| 자동 롤백 | 가능 | `prev` 태그 + 여러 조건 검증 (6·7장) |
| Flyway | 가능하나 별도 단계 | RDS 컬럼 상태를 먼저 확인 (9장) |

## 3. 필요한 변경 사항 (구현 단계에서)

1. `.github/workflows/ci.yml`, `.github/workflows/deploy-backend.yml`을 새로 만든다.
2. `deploy/ec2-deploy.sh`를 새로 만든다. EC2에서 실행할 배포 스크립트이고, SSM으로 전달한다. EC2에 계속 남는 파일은 아니다.
3. (선택) `git update-index --chmod=+x backend/gradlew`. 워크플로에서 `chmod`해도 된다.
4. (선택) Dockerfile에 `LABEL org.opencontainers.image.source=https://github.com/Jung-DaeYoung/uni-note`를 추가한다.
5. GHCR 이미지 이름은 소문자로 쓴다: `ghcr.io/jung-daeyoung/uni-note-backend:<sha>`
6. EC2 쪽 파일(`docker-compose.yml`, `backend.env`, uploads, truststore, Nginx)은 바꾸지 않는다.
7. Flyway는 2단계에서 진행한다 (9·10장).
8. (선택, 별도 검토) Actuator health 엔드포인트 (7장).

## 4. AWS 콘솔에서 직접 설정해야 할 항목

1. **IAM → Identity provider**
   - URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. **IAM Role** (예: `uninote-github-deploy`)
   - 신뢰 정책
     - `aud = sts.amazonaws.com`
     - `sub = repo:Jung-DaeYoung/uni-note:environment:production`
   - 권한
     - `ssm:SendCommand`: 다음 두 리소스로만 제한한다.
       - `arn:aws:ssm:ap-southeast-2::document/AWS-RunShellScript`
       - 해당 인스턴스 ARN
     - `ssm:GetCommandInvocation`, `ssm:ListCommandInvocations`
3. **EC2 인스턴스 프로파일**: `AmazonSSMManagedInstanceCore`. 현재 붙어 있는 Role은 [미확인]이다.
4. **SSM Fleet Manager**에서 인스턴스가 `Online`인지 확인한다.
5. **RDS 자동 백업과 삭제 방지**. 현재 보류 상태다. Flyway 도입 전에는 필수다.
6. (GHCR 패키지를 비공개로 둘 경우만) Parameter Store SecureString에 `read:packages` PAT를 저장하고, EC2 Role에 `ssm:GetParameter`를 준다.
   - 공개 저장소이므로 패키지도 공개로 두면 이 설정이 필요 없다.

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
| `AWS_ROLE_ARN` | Secret | OIDC로 Assume할 Role (로그에서 가려지도록 Secret에 둔다) |
| `AWS_REGION` | Variable | `ap-southeast-2` |
| `EC2_INSTANCE_ID` | Variable | SSM 대상 인스턴스 |
| `GITHUB_TOKEN` | 자동 제공 | GHCR push (`packages: write`) |

- AWS Access Key는 만들지 않는다.
- 운영 비밀값(DB, JWT, Gemini, truststore)은 GitHub에 넣지 않는다. 계속 EC2 `backend.env`에만 둔다.
- CI 테스트에 쓰는 DB·JWT 값은 더미 값이다. 워크플로에 직접 적는다.

## 6. Workflow 파일 구성안

### `ci.yml`

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main, feature/note-ai, 'ci/**']
```

- `paths` 필터는 걸지 않는다. 필수 체크로 지정한 job이 path 필터 때문에 실행되지 않으면 PR이 대기 상태로 남는다.
- `backend` job
  - `services.mysql: mysql:8.4` (DB `uninote_db`)
  - `setup-java`(temurin 21, gradle cache)
  - `chmod +x gradlew && ./gradlew test`
  - 더미 환경변수: `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`(32바이트 이상), `JWT_EXPIRATION`, `GEMINI_API_KEY=dummy`
- `frontend` job
  - `setup-node`(Netlify와 같은 버전 [확인 필요], npm cache `frontend/package-lock.json`)
  - `npm ci && npm run lint && npm test && npm run build`
  - 세 스크립트는 모두 `package.json`에 실제로 있다.
- `deploy-script` step
  - `sh -n deploy/ec2-deploy.sh`로 문법만 검사한다.
  - Ubuntu 러너의 `sh`는 dash라서 EC2와 같은 셸로 검사하게 된다.

### `deploy-backend.yml`

- 트리거
  - `push: main` (`paths: backend/**`, `deploy/**`, 이 워크플로 파일)
  - `workflow_dispatch` (입력값 `image_tag`, 롤백용)
- 설정
  - `concurrency: deploy-prod` (진행 중인 배포는 취소하지 않는다)
  - `environment: production`
  - `permissions: { contents: read, packages: write, id-token: write }`
- `build` job
  - 테스트 실행 → `docker/login-action`(ghcr) → `docker/build-push-action`
    - context: `backend`
    - platform: `linux/amd64`
    - cache: gha
    - 태그: `:${{ github.sha }}`, `:main`
  - `workflow_dispatch`로 실행하면 build를 건너뛰고 `image_tag`로 지정한 기존 이미지를 쓴다.
- `deploy` job
  1. `image_tag`가 `^[0-9a-f]{40}$` 형식인지 검증한다. 명령 주입을 막기 위해서다.
  2. `aws-actions/configure-aws-credentials`로 OIDC 인증을 한다.
  3. `deploy/ec2-deploy.sh`를 base64로 인코딩하고, `jq`로 SSM `--parameters` JSON을 만든다.
     - `commands`: `echo <b64> | base64 -d > /tmp/uninote-deploy.sh` → `sh /tmp/uninote-deploy.sh <TAG>`
     - `executionTimeout`: `900`
     - base64로 전달하는 이유는 세 가지다.
       - 따옴표 처리 문제가 없다.
       - SSM 문서 파라미터 문법 `{{ }}`가 `docker inspect -f '{{...}}'`와 부딪치지 않는다. SSM이 이 부분을 어떻게 처리하는지는 [확인 필요]인데, base64로 보내면 이 문제를 피할 수 있다.
       - 스크립트를 저장소에서 버전 관리하고 리뷰할 수 있다.
  4. `aws ssm wait command-executed` → `get-command-invocation`으로 결과 줄(`OK`, `ROLLED_BACK` 등)과 종료 코드를 확인한다.
  5. 외부 경로를 검증한다(7장): `https://uninote.duckdns.org/api/courses` → 403인지 확인한다.

### SSM 배포 스크립트 `deploy/ec2-deploy.sh` (설계안)

설계 원칙

- AWS-RunShellScript는 `sh`(Ubuntu에서는 dash)로 실행된다. 그래서 `pipefail`, `[[ ]]`, 배열 같은 bash 문법을 쓰지 않는다.
- `set -e`를 쓰지 않는다. 쓰면 배포가 실패했을 때 스크립트가 그 자리에서 끝나 롤백이 실행되지 않는다. 대신 단계마다 명시적으로 분기한다.
- 이미지를 교체하기 전에 실패하면(pull이나 tag 실패) 운영에 영향이 없다. 그대로 종료한다.
- 롤백한 뒤에도 같은 기준으로 상태를 검증한다. 롤백까지 실패하면 다른 종료 코드를 남긴다.
- 출력은 결과 줄만 남긴다. 공개 저장소라 Actions 로그가 공개되므로 컨테이너 로그나 환경값은 출력하지 않는다.

```sh
#!/bin/sh
# 사용: sh ec2-deploy.sh <40자리 commit SHA>
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
| (Actions) `https://uninote.duckdns.org/api/courses` → 403 | DNS·Nginx·TLS·프록시 경로 |

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
| 엔티티 변경(c731e49)을 병합한 뒤 validate 실패로 기동 실패 | 9장 순서대로 스키마를 먼저 맞춘다. 실패하면 `prev`로 자동 복구된다 |
| `sh`에서 `pipefail` 오류가 나거나 `set -e` 때문에 롤백 전에 종료 | POSIX sh로 작성하고 명시적으로 분기한다(6장). CI에서 `sh -n`으로 검사한다 |
| 롤백까지 실패해 서비스 중단 | `exit 2`로 구분한다. 워크플로 실패를 알림으로 받고 SSH로 긴급 복구한다(10장) |
| 403만 보고 성공으로 오판 | 여러 조건을 함께 보는 검증과 외부 경로 검증(7장) |
| 롤백한 이전 이미지가 새 스키마와 맞지 않음 | expand → contract로 나눈다. Flyway는 기본적으로 미래 버전 마이그레이션을 무시한다 |
| GHCR 이름 대문자로 push 실패 | `jung-daeyoung`으로 소문자 고정 |
| SSM이 root로 실행되어 compose 플러그인이 없거나 상대경로가 틀림 | `sudo docker compose version`을 미리 확인하고, 스크립트에서 `cd`한다 |
| SSM의 `{{ }}` 파라미터 해석과 따옴표 문제 | 스크립트를 base64로 전달한다 |
| 비공개 GHCR pull 실패 | 패키지를 공개로 두거나, Parameter Store 토큰으로 `docker login` |
| SHA 이미지가 쌓여 EBS 20GB가 가득 참 | 11장 정리 정책 |
| OIDC 범위가 넓어 다른 브랜치나 fork에서 배포 가능 | `sub`를 `environment:production`으로, 배포 브랜치는 main만 허용 |
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
- 더 이전 버전으로 수동 롤백할 때는 GHCR에서 다시 pull하면 된다. 공개 패키지라 GHCR 쪽 보관에는 제한이 없다. GHCR 정리는 필요할 때 따로 검토한다.
- `eclipse-temurin` 같은 빌드 기반 이미지는 EC2에서 빌드를 멈춘 뒤 한 번만 수동으로 정리한다. 자동 정리 대상에는 넣지 않는다.

## 12. 배포 실패 시 이전 Docker 이미지로 복구하는 방법

- **자동**: 6장 스크립트가 검증에 실패하면 `prev`로 되돌리고 같은 기준으로 다시 검증한다(`ROLLED_BACK`, exit 1).
- **수동**: `deploy-backend.yml`을 `workflow_dispatch`로 실행하고 `image_tag`에 이전 SHA를 넣는다. 그 SHA 이미지를 pull한 뒤 같은 스크립트로 교체하고 검증한다.
- **긴급** (롤백도 실패해 `ROLLBACK_FAILED`가 나왔을 때, EC2에서 직접)

  ```bash
  cd ~/uni-note
  docker images uninote-backend            # prev 존재 확인
  docker tag uninote-backend:prev uninote-backend:latest
  docker compose up -d --no-deps --force-recreate backend
  docker compose logs --tail=100 backend   # 원인 확인 (SSH 화면에서만, 공개 로그에 남기지 않는다)
  ```

- **DB**: 마이그레이션 때문에 문제가 생겼다면 이미지 롤백만으로는 복구되지 않을 수 있다. 배포 전에 만든 RDS 스냅샷에서 복원할지는 데이터 손실 범위를 확인한 뒤 결정한다.
