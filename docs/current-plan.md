# UniNote GitHub Actions 기반 CI/CD 구축 계획

작성일: 2026-11-09 · 개정: 2026-11-10 (IAM User Access Key + SSM 커스텀 문서 방식으로 변경) · 상태: **CI·GHCR 완료, 운영 RDS 재구축·수동 배포 완료(2026-11-10). SSM 문서 버전 2(실행 제한 600초)와 SSM 수동 실행 `Success` 확인. CD(`deploy` job)는 `ci/cd` 브랜치에 구현됨(미커밋). 가짜 SHA 테스트 후 main 병합 예정**

- 상세 설계는 `docs/ci_cd_설계.md`에 있다. 검증 조건, Flyway 경우 분류, DB 권한, 이미지 정리가 그 문서에 정리되어 있다.
- 2026-11-09 작업 결과와 인증 방식 결정 근거는 `docs/1109.md`에 있다.
- 이 문서는 단계·순서·완료 기준만 다룬다.
- EC2·AWS 상태는 직접 조회하지 않았다. 사용자 보고를 근거로 한 항목은 **(사용자 보고)**, 기록이 없는 항목은 **[미확인]**, 구현 전에 확인할 항목은 **[확인 필요]**로 표시한다.

## 방식 변경 (2026-11-10)

| 항목 | 이전 계획 | 현재 방식 |
|---|---|---|
| AWS 인증 | GitHub OIDC → IAM Role | **IAM User Access Key** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). Free Tier SCP가 `iam:*Provider*`를 막아 OIDC Provider를 만들 수 없다 (`1109.md` 6절) |
| SSM 문서 | `AWS-RunShellScript` + 저장소 스크립트를 base64로 전달 | **커스텀 문서 `UniNote-Deploy`**, 파라미터 `ImageTag` 하나 |
| 배포 스크립트 | 저장소 `deploy/ec2-deploy.sh` | **EC2 `/opt/uninote/deploy.sh`**. 저장소에는 없다 |
| 워크플로 | `deploy-backend.yml` 신규 | **기존 `ci.yml`에 `deploy` job만 추가** |
| GHCR 패키지 | Public 권장 | **Private**. EC2 root로 GHCR pull 인증 완료 (사용자 보고) |
| 이미지 태그 | `:<sha>`, `:main` | `:<sha>` 하나 (`ci.yml` `image` job) |
| 수동 배포·롤백 | `workflow_dispatch`(`image_tag`) | 이번 범위 밖. SSM 콘솔·CLI로 `UniNote-Deploy`를 직접 실행한다 |

## 먼저 알아 둘 점

- **작업 브랜치는 `origin/main`에서 딴 `ci/cd`다.**
  - `ci.yml`은 PR #7·#8로 `main`에만 있다. `feature/note-ai`에는 없다.
- **`c731e49`는 이미 main에 병합됐다** (PR #6). 이 커밋은 Enrollment에 `academic_year`·`semester`(NOT NULL) 컬럼과 unique 키를 추가했다.
  - 운영은 `ddl-auto: validate`라서, RDS에 컬럼이 없으면 이 커밋 이후 이미지가 기동에 실패한다.
  - **2026-11-10 해소 (사용자 보고).** 운영 RDS를 로컬 DB 덤프로 재구축했다. 두 컬럼은 NOT NULL이고 주요 데이터 건수가 로컬과 일치한다.
  - 같은 날 main `307458768d792d6bd1c405fa18055d773e3b5e1a` 이미지를 EC2 `deploy.sh`로 수동 배포했다. GHCR pull, Compose 재시작, 헬스체크, RDS 연결, Netlify 화면(학년·학기 표시)을 확인했다.
  - DB를 자동으로 변경하거나 재초기화하는 방식은 쓰지 않는다.
- **CD가 켜지면 main push마다 자동 배포된다.** 스키마를 바꾸는 커밋은 7단계 순서를 지켜 병합한다.
- **공개 저장소라 Actions 로그도 공개된다.** `deploy` job은 SSM 결과의 `Status`와 `ResponseCode`만 출력한다. `deploy.sh` stdout, 컨테이너 로그, 환경값은 출력하지 않는다.

## 1. 현재 구조와 목표 구조

| 구분 | 현재 | 목표 |
|---|---|---|
| PR 검증 | **완료.** PR마다 Backend 테스트, Frontend lint·test·build | 유지 |
| Backend 빌드 | **완료.** main push에서 Actions가 빌드 | 유지 |
| 이미지 | **완료.** GHCR `ghcr.io/jung-daeyoung/uni-note-backend:<sha>` (Private) | 유지 |
| 배포 | EC2에서 `deploy.sh <sha>` 수동 실행 (2026-11-10 성공) | main push → `ci.yml` `deploy` → SSM `UniNote-Deploy` → EC2 `/opt/uninote/deploy.sh <sha>` |
| 롤백 | `deploy.sh`가 `prev` 태그로 복구 (사용자 보고, 실패 시나리오는 미검증) | 유지 |
| 스키마 | RDS에서 수동 SQL | Flyway(baseline + 이후 버전) |
| Frontend | Netlify | 그대로. Actions는 검증만 |
| EC2 설정 | compose, `backend.env`, uploads, truststore, Nginx, Certbot | **그대로** |

## 2. 아키텍처와 동작 흐름

```
[PR(main)] ──► ci.yml
   ├─ backend  : MySQL 8.4 service → ./gradlew test
   ├─ frontend : npm ci → lint → test → build
   └─ image, deploy : skipped (main push 아님)

[main push] ──► ci.yml
   ├─ backend ∥ frontend
   ├─ image   (needs: backend, frontend) → GHCR push :<github.sha>
   └─ deploy  (needs: image, concurrency: deploy-prod)
        ├─ IAM User 키(Secrets) → ssm:SendCommand UniNote-Deploy (ImageTag=<github.sha>)
        ├─ ssm:GetCommandInvocation 폴링 (10초 간격, 최대 15분)
        └─ Status ≠ Success → job 실패
EC2 (root) /opt/uninote/deploy.sh <sha>
   pull → latest를 prev로 보존 → <sha>를 latest로 → compose 재기동 → 헬스체크
   실패 → prev로 복귀 후 0이 아닌 값으로 종료

[Netlify] main 병합 → 기존대로 자동 배포 (변경 없음)
```

- 같은 run 안에서는 모든 job의 `github.sha`가 같다. 그래서 `deploy`의 `ImageTag`는 `image` job이 push한 태그와 정확히 일치한다.
- `aws ssm wait command-executed`는 쓰지 않는다. 이 waiter는 약 100초(5초 × 20회)만 기다리므로, 배포가 그보다 길면 EC2에서 배포가 진행 중인데 Actions만 실패한다.

## 3. 단계별 작업

### 1단계. 환경 분석 — 완료

- 결과는 `1109.md` 1절에 있다 (Ubuntu 24.04.5, t3.small, Compose 2.40.3 등).
- 남은 미확인 항목은 `1109.md` 12절에 있다.

### 2단계. CI 구축 — 완료 (PR #7)

- `ci.yml`의 `backend`·`frontend` job. PR 실행에서 둘 다 success, `image`는 skipped.

### 3단계. GHCR 구축 — 완료 (PR #8)

- `ci.yml`의 `image` job (`needs: [backend, frontend]`, main push에서만 실행).
- 태그는 `ghcr.io/jung-daeyoung/uni-note-backend:${{ github.sha }}` 하나다.

### 4단계. AWS·EC2 준비 — 사용자 보고 기준 완료

**완료 (사용자 보고)**

- GitHub Repository Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- EC2: root로 Private GHCR pull 인증 완료
- SSM: 인스턴스 `i-0bf5c3061e672a073`이 Managed Node Online
- SSM Document `UniNote-Deploy` (파라미터 `ImageTag`)
- EC2 배포 스크립트 `/opt/uninote/deploy.sh`: SHA 형식 검증, root 확인, `flock`, GHCR pull, `prev` 보존, `latest` 교체, Compose 재시작, 헬스체크(`127.0.0.1:8080/api/courses` → 200·401·403), 실패 시 `prev` 롤백. 2026-11-10 수동 배포에 사용했다
- 이번 범위에서는 `deploy.sh`를 수정하지 않는다

**병합 전에 확인할 항목** (모두 읽기 전용)

- `UniNote-Deploy` 문서 내용: `aws ssm get-document --name UniNote-Deploy --region ap-southeast-2`
  - `aws:runShellScript`가 `/opt/uninote/deploy.sh {{ImageTag}}`를 실행하는가
  - 스크립트 종료 코드가 그대로 step 상태가 되는가 (`|| true`, 뒤따르는 다른 명령이 실패를 가리지 않는가)
  - `ImageTag`에 `allowedPattern: ^[0-9a-f]{40}$`가 있는가
  - `aws:runShellScript`의 `timeoutSeconds`가 **600**이고, 그 버전이 기본 버전인가 (`aws ssm describe-document --name UniNote-Deploy --region ap-southeast-2 --query "Document.[DefaultVersion,LatestVersion]"`) — **완료 (2026-11-10, 사용자 보고)**: 버전 2에 600 설정, 버전 2가 기본 버전
  - wrapper(문서의 `aws:runShellScript` 명령, `set -eu`, 사용자 보고)가 `deploy.sh`를 `sh`가 아닌 실행 파일로 직접 호출하는가
- `/opt/uninote/deploy.sh`(bash, `set -Eeuo pipefail`, 사용자 보고): pull·헬스체크 실패 시 0이 아닌 값으로 끝나는가. 실패 시 `prev`로 복구한 뒤에도 0이 아닌 값으로 끝나는가. `-e` 때문에 롤백 전에 중단되지 않도록 조건문이나 `ERR` trap으로 롤백 경로가 보장되는가
- IAM User 정책의 Resource ARN (아래 권한 표)

**IAM User 최소 권한**

| Action | Resource |
|---|---|
| `ssm:SendCommand` | `arn:aws:ssm:ap-southeast-2:<계정ID>:document/UniNote-Deploy` 와 `arn:aws:ec2:ap-southeast-2:<계정ID>:instance/i-0bf5c3061e672a073` (둘 다 필요) |
| `ssm:GetCommandInvocation` | `*` |

- 커스텀 문서 ARN에는 계정 ID가 들어간다. AWS 관리형 문서(`::document/AWS-…`)와 형식이 다르다.
- `AWS-RunShellScript`는 허용하지 않는다.
- 결과 확인에는 위 두 권한이면 충분하다. `ssm:ListCommandInvocations`는 이 계획에서 쓰지 않는다.

**보안 권장 (사용자 결정)**

- Repository Secret은 모든 브랜치의 push 워크플로에서 읽을 수 있다. 키를 main 전용 Environment `production`의 Secret으로 옮기고 `deploy` job에 `environment: production`을 지정하기를 권장한다.
- Access Key는 주기적으로 교체하고 CloudTrail로 사용 기록을 확인한다.

### 5단계. CD job 추가 — 현재 작업 (`ci/cd` 브랜치에 구현, 미커밋)

**선행 조건**: 4단계 "병합 전에 확인할 항목" 확인 완료, `origin/main`에서 딴 작업 브랜치

**할 일**: `.github/workflows/ci.yml` 끝에 아래 `deploy` job만 추가한다. 기존 job, 트리거, 최상위 `permissions`·`concurrency`는 바꾸지 않는다.

```yaml
  deploy:
    name: Deploy backend (SSM)
    needs: image
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions: {}
    # main push가 연달아 와도 배포가 겹치지 않게 한다. 진행 중인 배포는 취소하지 않는다.
    concurrency:
      group: deploy-prod
      cancel-in-progress: false
    env:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      AWS_DEFAULT_REGION: ap-southeast-2
      INSTANCE_ID: i-0bf5c3061e672a073

    steps:
      - name: Run UniNote-Deploy
        run: |
          cmd_id=$(aws ssm send-command --document-name UniNote-Deploy \
            --instance-ids "$INSTANCE_ID" \
            --timeout-seconds 120 \
            --parameters "{\"ImageTag\":[\"$GITHUB_SHA\"]}" \
            --query Command.CommandId --output text)
          echo "CommandId: $cmd_id"
          status=Pending
          for i in $(seq 1 90); do        # 10초 × 90 = 최대 15분
            sleep 10
            if ! out=$(aws ssm get-command-invocation --command-id "$cmd_id" \
                --instance-id "$INSTANCE_ID" --query Status --output text 2>&1); then
              case "$out" in *InvocationDoesNotExist*) continue ;; esac
              echo "$out" >&2
              exit 1
            fi
            status=$out
            case "$status" in Pending|InProgress|Delayed) ;; *) break ;; esac
          done
          aws ssm get-command-invocation --command-id "$cmd_id" --instance-id "$INSTANCE_ID" \
            --query '[Status,ResponseCode]' --output text || true
          if [ "$status" != "Success" ]; then
            echo "::error::SSM deploy did not succeed (status: $status)"
            exit 1
          fi
```

- 실제 구현은 `.github/workflows/ci.yml`의 `deploy` job이다. 위 예시와 주석만 다르다.

- 러너(`ubuntu-latest`)에 AWS CLI가 설치되어 있어 checkout이나 추가 action이 필요 없다.
- timeout: 전달 대기 `--timeout-seconds 120` + SSM 문서 실행 제한 600초 = 720초 < 폴링 15분(900초) < job 20분. Actions가 기다리는 동안 SSM 명령이 반드시 끝난다.
- 자격 증명은 secrets를 env로만 넘긴다. `set -x`를 쓰지 않는다. GitHub가 secret 값을 로그에서 마스킹한다.
- 리전과 인스턴스 ID는 비밀 값이 아니다. `image` job의 `IMAGE`처럼 job `env`에 둔다.
- 명령 직후에는 `InvocationDoesNotExist`가 나올 수 있다. 이 오류만 재시도하고, 권한 오류 같은 다른 오류는 바로 실패시킨다.
- `Status`가 `Success`가 아니면(`Failed`, `TimedOut`, `Cancelled`, 15분 초과) 마지막 줄이 실패해 job이 실패한다.
- PR에서는 `image`가 skipped라 `deploy`도 skipped다. fork PR에는 secrets가 전달되지 않는다. 필수 체크(`backend`·`frontend`)에는 영향이 없다.

**완료 기준**

- PR에서 `deploy`가 skipped이고 `backend`·`frontend`가 통과한다.
- main 병합 후 `deploy`가 success이고, EC2 컨테이너가 새 SHA 이미지로 실행된다.
- Actions 로그에 자격 증명, `deploy.sh` 출력, 컨테이너 로그가 없다.

### 6단계. 실패·롤백 검증

- SSM 콘솔이나 CLI로 `UniNote-Deploy`를 존재하지 않는 SHA(형식은 맞는 40자리)로 실행한다. pull 실패로 0이 아닌 값이 나오고 운영 컨테이너가 바뀌지 않는지 확인한다.
- 기동에 실패하는 이미지로 실행해 `prev`로 복구되고 `Status`가 `Failed`인지 확인한다. 방법은 `deploy.sh` 구현에 따른다 [확인 필요].
  - 첫 자동 배포가 성공한 **뒤에** 한다. 지금 `prev`는 2026-11-07 구버전 이미지일 수 있고, 그 이미지로 롤백되면 학년·학기 필드가 없어 화면에 `NaN`이 나온다. 새 SHA 배포가 한 번 성공하면 `prev`가 `3074587` 이미지로 바뀐다.
- 이전 SHA로 `UniNote-Deploy`를 실행하는 수동 롤백을 확인한다.

**완료 기준**

- 세 시나리오에서 서비스가 정상으로 남고, 실패 시나리오는 SSM `Failed`로 끝난다.
- `backend.env`, uploads, truststore, Nginx는 바뀌지 않았다.

### 7단계. Flyway 도입

**선행 조건**

- 6단계 완료
- Flyway 경우 A·B·C를 판정했다 (`SHOW CREATE TABLE enrollments;`, 읽기 전용).
- DB 계정 방안을 정했다 (`SELECT CURRENT_USER(); SHOW GRANTS;`, 읽기 전용).
- 배포 직전 RDS 수동 스냅샷을 만들었다.

**공통 변경**

- `build.gradle`: `flyway-core`, `flyway-mysql`(Boot BOM 버전)
- `application.yaml`: `spring.flyway.enabled: false`. 로컬과 CI는 `ddl-auto: update`를 유지한다.
- `application-prod.yaml`: `enabled: true`, `baseline-on-migrate: true`, `baseline-version: 1`
- `V1__baseline.sql`
  - RDS에서 `mysqldump --no-data --skip-add-drop-table --set-gtid-purged=OFF`로 받는다(읽기 전용).
  - `AUTO_INCREMENT=`는 제거한다.
  - **RDS를 마지막으로 수동 변경한 뒤, Flyway를 처음 실행하기 전에** 받는다.
- `ci.yml`: 빈 MySQL 8.4에서 Flyway를 켜고 validate로 `contextLoads`를 실행하는 job을 추가한다.
  - Flyway 10.x가 MySQL 8.4를 지원하는지도 이 job에서 확인한다([확인 필요]).
- `docs/database.md`: "스키마 변경은 새 V 파일로" 규칙을 적는다.

**경우별 적용**

| 경우 | RDS 상태 | V2 | 적용 순서 |
|---|---|---|---|
| A | 컬럼 NOT NULL과 unique 키가 모두 있음 | 만들지 않음 (다음 변경이 V2) | 스냅샷 → V1 덤프 → Flyway 이미지 배포(baseline만 기록) → `feature/note-ai` 병합 |
| B | 컬럼 없음 | `V2__enrollment_term.sql` = `docs/database.md`의 DDL (시드 INSERT 제외) | 스냅샷 → V1·V2가 있고 엔티티는 바뀌지 않은 이미지 배포 → `flyway_schema_history`에 1·2가 기록됐는지 확인 → `feature/note-ai` 병합 |
| C | 일부만 있음 | 만들지 않음 | 스냅샷 → 수동으로 A 상태까지 맞춤 → A 순서 |

- **2026-11-10 현황:** `c731e49`는 이미 main에 병합됐으므로 표의 마지막 단계(`feature/note-ai` 병합)는 끝난 상태다. 운영 RDS를 두 컬럼이 NOT NULL인 덤프로 재구축했으므로 경우 A로 본다. Flyway 도입 전에 `SHOW CREATE TABLE enrollments;`로 unique 키까지 한 번 더 확인한다.

- 경우 B의 순서가 안전한 근거가 있다.
  - 앱 코드에는 Enrollment를 저장하는 곳이 없다.
  - validate는 남는 컬럼을 무시한다.
  - 그래서 컬럼을 먼저 추가해도(expand) 기존 이미지가 깨지지 않는다.
- B 대신 수동 DDL로 A 상태를 만드는 방법(B')도 있다. 운영 RDS를 바꾸는 일이라 사용자가 결정한다.

**중복 실행을 막는 규칙**

- `baseline-version`은 RDS에 이미 반영된 마지막 버전과 같아야 한다.
- baseline이 기록된 뒤에는 V1·V2를 수정하지 않는다. 고칠 내용이 있으면 새 버전 파일로 만든다.

**DB 계정** (설계 문서 10장)

- 권장 방안: datasource는 앱 계정(DML만), `spring.flyway.user/password`는 마이그레이션 계정(DDL 포함)으로 나눈다.
- 다음 작업은 운영 설정 변경이므로 **사용자가 직접** 한다.
  - RDS에서 계정 만들기
  - `backend.env`에 `FLYWAY_USER`·`FLYWAY_PASSWORD` 추가
- 지금 앱이 마스터 계정을 쓰고 있다면, DML 전용 앱 계정으로 바꾸는 일을 먼저 한다.

**완료 기준**

- CI의 Flyway job이 통과한다.
- 운영 `flyway_schema_history`에 경우별로 예상한 버전이 기록된다.
- 데이터 건수가 바뀌지 않았다.

### 8단계. 통합 테스트

**선행 조건**: 1~7단계 완료

**할 일**

- PR 하나로 전체 흐름을 확인한다: CI → 병합 → GHCR → SSM `UniNote-Deploy` → `deploy.sh` 헬스체크
- `https://uninote.duckdns.org`에서 직접 확인한다.
  - 로그인
  - 노트 생성·자동 저장·새로고침
  - 1MB 이상 업로드, 컨테이너를 다시 만든 뒤에도 파일이 남는지
  - AI 퀴즈 생성(60~150초 동안 504가 나지 않는지)
  - 풀이와 오답노트
- 롤백 테스트를 다시 한다.
- 문서를 갱신한다: `aws-deployment-guide.md` 12장, `배포환경 설계.md`, `ci_cd_설계.md`

**완료 기준**: 위 항목이 모두 통과하고, 결과를 문서에 기록했다.

## 4. 단계별 변경 파일·설정 요약

| 단계 | 저장소 파일 | GitHub 설정 | AWS·운영 설정 |
|---|---|---|---|
| 1 | 없음 | 없음 | 없음 (조회만) — 완료 |
| 2 | `.github/workflows/ci.yml` — 완료 | main Ruleset 필수 체크 | 없음 |
| 3 | `ci.yml` `image` job — 완료 | 없음 | 없음 |
| 4 | 없음 | Repository Secrets 2개 — 완료 (권장: Environment `production`으로 이동) | IAM User, SSM Document, `/opt/uninote/deploy.sh`, EC2 GHCR 로그인 — 완료 (사용자 보고) |
| 5 | `ci.yml` `deploy` job | 없음 | 없음 |
| 6 | 없음 | 없음 | 없음 (SSM 수동 실행만) |
| 7 | `build.gradle`, `application.yaml`, `application-prod.yaml`, `db/migration/V1~`(경우 B면 V2), `ci.yml`, `docs/database.md` | 없음 | RDS 스냅샷, (계정 분리 시) 마이그레이션 계정 생성, `backend.env` 추가 (사용자 수행) |
| 8 | 문서 3개 | 없음 | 없음 |

## 5. 예상되는 기술적 문제와 해결 방안

| 문제 | 해결 방안 |
|---|---|
| `aws ssm wait`가 약 100초 뒤 실패해 정상 배포를 실패로 표시 | waiter 대신 최대 15분 폴링 루프 |
| 명령 직후 `InvocationDoesNotExist` | 폴링 루프에서 재시도 |
| `deploy.sh`나 문서가 실패를 0으로 끝내 Actions가 성공으로 표시 | 4단계에서 문서·스크립트 종료 코드 확인, 6단계에서 실패 시나리오 검증 |
| `deploy.sh`(`set -Eeuo pipefail`)가 `-e` 때문에 롤백 전에 종료 | 조건문 또는 `ERR` trap으로 롤백 경로 보장 여부를 확인 [확인 필요] (설계 문서 6장) |
| wrapper(`set -eu`, `sh`)가 `deploy.sh`를 `sh`로 호출해 bash 옵션이 오류 | wrapper가 실행 파일로 직접 호출하는지 확인 [확인 필요] |
| `SendCommand` AccessDenied | 문서 ARN에 계정 ID 포함, 인스턴스 ARN도 함께 허용 |
| main push가 연달아 와서 배포가 겹침 | `deploy` job `concurrency: deploy-prod`, `cancel-in-progress: false` |
| SHA 이미지가 쌓여 디스크 부족 | `deploy.sh`의 정리 정책 (설계 문서 11장) |
| Flyway 10.x와 MySQL 8.4 호환 [확인 필요] | 7단계 CI job에서 검증 |
| Flyway baseline·V2 중복 또는 누락 | 경우 A·B·C 판정, `baseline-version` 규칙, V1 덤프 시점 고정 |
| 롤백한 이전 이미지가 새 스키마와 맞지 않음 | expand → contract. Flyway는 미래 버전을 무시한다 |
| `c731e49`(이미 main)가 든 이미지가 운영 RDS 스키마와 맞지 않아 첫 자동 배포가 기동 실패 | 해소(2026-11-10). RDS 재구축 후 `3074587` 수동 배포로 기동 확인 |
| SSM 명령이 Actions 폴링보다 오래 실행됨 | 전달 120초 + SSM 문서 실행 제한 600초 < 폴링 900초 |

## 6. 운영 데이터·보안 위험

**데이터**

- RDS 백업 및 삭제 방지 설정을 자동 배포 활성화 전에 확인한다.
- MySQL DDL은 롤백할 수 없다. 마이그레이션이 들어간 배포 전에는 스냅샷을 만들고, 파괴적 DDL은 따로 검토한다.
- uploads는 호스트 볼륨이다. `docker compose down -v`, `docker volume rm`, `docker system prune -a`, `docker image prune -a`는 쓰지 않는다.

**보안**

- IAM User 권한은 `UniNote-Deploy` 문서 하나와 인스턴스 하나에 대한 `SendCommand`, 그리고 `GetCommandInvocation`으로 제한한다.
- Access Key는 장기 키다. Environment `production`(main 전용)으로 옮기기를 권장하고, 주기적으로 교체한다. `pull_request_target`은 쓰지 않는다.
- `ImageTag`는 SSM 문서의 `allowedPattern`과 `deploy.sh`에서 SHA 형식을 검증한다 [확인 필요].
- SSM은 root로 `deploy.sh`를 실행한다. 스크립트는 root 소유 755로 두고 `set -x`를 쓰지 않는다.
- Actions 로그에는 `Status`와 `ResponseCode`만 남긴다. `backend.env`는 읽지도 출력하지도 않는다.
- `packages: write`는 `image` job에만 있다. `deploy` job은 `permissions: {}`다.
- DB 계정: 앱 계정은 DML만, 마이그레이션 계정은 마스터 계정과 분리한다. 현재 계정은 [확인 필요]다.

## 7. 구축 순서

1. ~~1단계 분석~~, ~~2단계 CI~~, ~~3단계 GHCR~~, ~~4단계 AWS·EC2 준비(사용자 보고)~~, ~~운영 RDS 재구축과 `3074587` 수동 배포(2026-11-10)~~
2. 5단계 마무리 (아래 "테스트 순서")
3. 6단계 실패·롤백 검증 (첫 자동 배포 성공 뒤)
4. 7단계 Flyway (경우 A)
5. 8단계 통합 테스트와 문서 갱신

### 테스트 순서 (5단계 마무리)

1. ~~**SSM 문서 확인**~~ — **완료 (2026-11-10, 사용자 보고)**. 버전 2 생성, `aws:runShellScript` `timeoutSeconds: 600`, 버전 2를 기본 버전으로 지정(콘솔 Versions 탭에서 확인).
2. ~~**SSM 수동 실행 — 성공**~~ — **완료 (2026-11-10, 사용자 보고)**. Run Command에서 기본 버전으로 `ImageTag=307458768d792d6bd1c405fa18055d773e3b5e1a` 실행 → `Success`. ResponseCode는 따로 확인하지 않았다. 같은 SHA라 `prev`는 바뀌지 않는다.
3. **SSM 수동 실행 — 실패** (사용자, 미완료): 형식만 맞는 가짜 SHA(`0` 40개)로 실행 → `Failed`, 운영 컨테이너 그대로.
4. **커밋·push·PR** (Claude Code, 사용자 승인 후): `ci/cd`의 `ci.yml`·문서 2개 → `git push -u origin ci/cd` → main 대상 PR. PR에서 `backend`·`frontend` success, `image`·`deploy` skipped.
5. **병합 → 첫 자동 배포** (사용자): `deploy` job success, 운영 이미지가 병합 커밋 SHA로 바뀜, Netlify 화면 정상, Actions 로그에 자격 증명·컨테이너 로그 없음.
6. 6단계 실패·롤백 검증으로 넘어간다.

각 단계는 별도 PR로 진행하고, 완료 기준을 확인한 뒤 다음 단계로 넘어간다.

## 다음 작업

- 테스트 순서 3(가짜 SHA로 SSM 실행 → `Failed`)을 진행한다. 테스트 순서 1·2는 완료했다.
- 통과하면 `ci/cd` 변경을 커밋·push하고 PR을 만들어 병합한다 (테스트 순서 4·5).
- (사용자 결정) Secrets를 Environment `production`으로 옮길지, RDS 백업·삭제 방지 설정 확인.
