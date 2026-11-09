# UniNote GitHub Actions 기반 CI/CD 구축 계획

작성일: 2026-11-09 · 개정: 2026-11-09 (`ci_cd_설계.md` 검토 반영) · 상태: **계획 수립 완료, 구현 전 (1단계 대기)**

- 상세 설계는 `docs/ci_cd_설계.md`에 있다. 배포 스크립트 전문, 검증 조건, Flyway 경우 분류, DB 권한, 이미지 정리가 모두 그 문서에 정리되어 있다.
- 이 문서는 단계·순서·완료 기준만 다룬다. 같은 내용을 두 곳에서 관리하지 않도록 스크립트 전문은 설계 문서에만 둔다.
- EC2·AWS 상태는 직접 조회하지 않았다. 기록이 없는 항목은 **[미확인]**, 구현 전에 확인할 항목은 **[확인 필요]**로 표시한다.

## 먼저 알아 둘 점

- **`feature/note-ai`를 그대로 main에 병합하지 않는다.**
  - 이 브랜치의 `c731e49`가 Enrollment에 `academic_year`·`semester`(NOT NULL) 컬럼과 unique 키를 추가했다.
  - RDS 상태가 확인되지 않은 채 병합하면 첫 배포가 validate 단계에서 실패한다.
  - CI/CD 작업은 main에서 딴 **`ci/actions`** 브랜치에서 한다.
- **공개 저장소라 Actions 로그도 공개된다.** SSM 출력에는 결과 줄만 남긴다. 컨테이너 로그와 환경값은 출력하지 않는다.

## 1. 현재 구조와 목표 구조

| 구분 | 현재 | 목표 |
|---|---|---|
| PR 검증 | 없음 | PR마다 Backend 테스트, Frontend lint·test·build를 실행하고, 통과해야 병합 |
| Backend 빌드 | EC2(t3.small)에서 `docker build` | Actions에서 빌드하고, EC2는 pull만 |
| 이미지 | 로컬 `uninote-backend:latest` 하나 | GHCR `ghcr.io/jung-daeyoung/uni-note-backend:<sha>` |
| 배포 | SSH로 접속해 pull, build, 재기동 | main 병합 → Actions → OIDC → SSM → EC2에서 pull·retag·재기동 |
| 롤백 | 없음 | `prev` 태그로 자동 복구하고 다시 검증. SHA를 지정한 수동 복구도 가능 |
| 스키마 | RDS에서 수동 SQL | Flyway(baseline + 이후 버전) |
| Frontend | Netlify | 그대로. Actions는 검증만 |
| EC2 설정 | compose, `backend.env`, uploads, truststore, Nginx, Certbot | **그대로.** compose도 수정하지 않는다 (pull한 뒤 `uninote-backend:latest`로 retag) |

## 2. 아키텍처와 동작 흐름

```
[PR / push(main, feature/note-ai, ci/**)] ──► ci.yml
   ├─ backend      : MySQL 8.4 service → ./gradlew test
   ├─ frontend     : npm ci → npm run lint → npm test → npm run build
   └─ deploy-script: sh -n deploy/ec2-deploy.sh
   ⇒ main 보호 규칙(필수 체크) 통과 시 병합 가능

[main 병합(backend/**, deploy/** 변경)] ──► deploy-backend.yml
   ├─ build  : 테스트 → docker build(backend/) → GHCR push :<sha>, :main
   └─ deploy (environment: production)
        ├─ image_tag 검증(^[0-9a-f]{40}$)
        ├─ OIDC → AssumeRole (environment:production만 허용)
        ├─ SSM AWS-RunShellScript: deploy/ec2-deploy.sh를 base64로 전달 → sh로 실행
        │    pull → (latest≠new면) latest→prev → new→latest → 재기동 → healthy()
        │    실패 → prev→latest → 재기동 → healthy() 재검증
        │    결과 줄: OK / PULL_FAILED / DEPLOY_FAILED+ROLLED_BACK / ROLLBACK_FAILED / NO_PREV_IMAGE
        └─ 외부 검증: https://uninote.duckdns.org/api/courses == 403

[Netlify] main 병합 → 기존대로 자동 배포 (변경 없음)
```

- **배포 검증 `healthy()`**: 아래 조건을 모두 만족해야 성공으로 본다. 자세한 내용은 설계 문서 7장에 있다.
  - 컨테이너 이미지 ID가 새 이미지 ID와 같다.
  - 컨테이너가 Running 상태다.
  - 로그에 `Started BackendApplication`이 있다. 운영은 validate 모드라서, 이 로그가 찍혔다면 기동 시점에 DB 연결과 스키마 검증을 통과한 것이다.
  - `127.0.0.1:8080/api/courses`가 403을 돌려준다.
  - 15초 동안 `RestartCount`가 늘지 않는다.
- **403 단독 검증의 한계**: DB 조회를 거치지 않는다. 다른 프로세스가 응답하거나 컨테이너가 crash loop에 빠져도 403이 나올 수 있다. 그래서 위 조건을 함께 본다.
- **Actuator health**: 코드와 의존성을 추가해야 하므로 별도 PR에서 검토한다.

## 3. 단계별 작업

### 1단계. 환경 분석 (읽기 전용)

**할 일**

- EC2
  - `snap services amazon-ssm-agent`
  - IMDSv2로 `iam/info` 조회
  - `docker compose version`
  - **`sudo docker compose version`**: SSM 명령은 root로 실행된다.
  - `command -v curl base64`
  - `df -h /`, `docker images`, `uname -m`
- AWS 콘솔
  - EC2 인스턴스 프로파일
  - 보안 그룹 아웃바운드 443
  - RDS 자동 백업, 삭제 방지
- RDS (읽기 전용)
  - `SHOW CREATE TABLE enrollments;`: Flyway 경우 A·B·C를 판정한다.
  - 앱 계정으로 `SELECT CURRENT_USER(); SHOW GRANTS;`: 마스터 계정인지, DDL 권한이 있는지 확인한다.
  - `SELECT VERSION();`
- Netlify: 빌드 로그에서 Node 버전을 확인한다. 로컬은 v24.22.1이다.

**변경 대상**: 없음

**완료 기준**: 위 항목을 모두 [확인] 또는 [없음]으로 정리했다. Flyway 경우와 DB 계정 방안이 정해졌다.

### 2단계. CI 구축

**선행 조건**: 1단계 완료, `ci/actions` 브랜치

**할 일**

- `.github/workflows/ci.yml` 신규 작성
  - 트리거: `pull_request: [main]`, `push: [main, feature/note-ai, 'ci/**']`
  - `paths` 필터는 걸지 않는다. 필수 체크를 쓰면 job이 건너뛰어진 PR이 대기 상태로 남는다.
  - `backend` job
    - `mysql:8.4` service
    - `setup-java`(temurin 21)
    - `chmod +x gradlew && ./gradlew test`
    - 더미 환경변수: `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`(32바이트 이상), `JWT_EXPIRATION`, `GEMINI_API_KEY=dummy`
  - `frontend` job
    - `setup-node`(Netlify와 같은 버전 [확인 필요])
    - `npm ci && npm run lint && npm test && npm run build`
    - `package.json`에 실제로 있는 스크립트만 쓴다.
  - `deploy-script` job: `sh -n deploy/ec2-deploy.sh`
    - 러너의 `sh`는 dash라서 EC2와 같은 셸로 검사된다.
    - 이 job은 5단계에서 스크립트가 생긴 뒤에 추가한다.
- GitHub: main Ruleset에서 `backend`·`frontend` 체크를 필수로 지정한다.
- (선택) `git update-index --chmod=+x backend/gradlew`

**완료 기준**

- `ci/actions` push와 PR에서 모든 job이 통과한다.
- 일부러 깨뜨린 커밋은 병합이 막힌다.

### 3단계. GHCR 구축

**선행 조건**: 2단계 완료

**할 일**

- `.github/workflows/deploy-backend.yml`에 `build` job만 만든다.
  - `packages: write`
  - `docker/login-action`
  - `docker/build-push-action`(context `backend`, `linux/amd64`, 태그 `:<sha>`·`:main`, gha cache)
- (선택) Dockerfile에 `LABEL org.opencontainers.image.source=...`를 추가한다.
- GitHub: 패키지 visibility를 **Public**으로 하기를 권장한다. 이미지에 비밀값이 없고, 이렇게 하면 EC2에서 로그인할 필요가 없다.
- EC2에서 `docker pull ...:<sha>`만 직접 실행해 확인한다. 컨테이너는 교체하지 않는다.

**완료 기준**: GHCR에 SHA 태그가 생기고, EC2에서 pull이 성공한다.

### 4단계. AWS OIDC·SSM 구성

**선행 조건**: 1단계에서 SSM Agent, Role, root의 compose 사용 가능 여부를 확인했다.

**AWS 설정**

1. IAM Identity provider를 추가한다.
   - URL `token.actions.githubusercontent.com`
   - Audience `sts.amazonaws.com`
2. 배포 Role `uninote-github-deploy`를 만든다.
   - 신뢰 조건
     - `aud = sts.amazonaws.com`
     - `sub = repo:Jung-DaeYoung/uni-note:environment:production`
   - 권한
     - `ssm:SendCommand`: 아래 두 리소스로만 제한한다.
       - `AWS-RunShellScript` 문서
       - 해당 인스턴스 ARN
     - `ssm:GetCommandInvocation`, `ssm:ListCommandInvocations`
3. EC2 인스턴스 프로파일에 `AmazonSSMManagedInstanceCore`를 붙인다.

**GitHub 설정**

- Environment `production`: main만 배포 가능
- Variables: `AWS_REGION`, `EC2_INSTANCE_ID`
- Secret: `AWS_ROLE_ARN`

**검증**

- Fleet Manager에서 인스턴스가 Online인지 본다.
- `workflow_dispatch`로 `sts get-caller-identity`와 SSM `docker ps`만 실행해 본다. 둘 다 읽기 전용이다.

**완료 기준**: OIDC 인증과 SSM 읽기 명령이 성공하고, main이 아닌 브랜치에서는 AssumeRole이 거부된다.

### 5+6단계. Backend CD와 자동 롤백

롤백 없이 자동 배포를 켜지 않는다. 그래서 두 단계를 같은 PR에서 구현한다.

**선행 조건**: 3·4단계 완료, RDS 자동 백업이 켜져 있다.

**할 일**

- `deploy/ec2-deploy.sh`를 새로 만든다. 전문은 설계 문서 6장에 있다.
  - POSIX `sh`로 쓴다. `pipefail`, `set -e`, bash 전용 문법을 쓰지 않는다.
  - 교체 전 단계(pull·tag)에서 실패하면 운영 영향 없이 종료한다.
  - 교체한 뒤 `healthy()`에 실패하면 `prev`로 되돌리고 **같은 기준으로 다시 검증**한다.
  - 종료 코드
    - 0: 성공
    - 1: 교체 전 실패, 또는 배포 실패 후 롤백 성공
    - 2: 롤백 실패
    - 3: `prev` 없음
  - 같은 SHA를 다시 배포하면 `prev`를 덮어쓰지 않는다.
  - 배포에 성공했을 때만 `cleanup()`을 실행한다. 이미지 정리 정책은 아래에 있다.
- `deploy-backend.yml`에 `deploy` job을 추가한다.
  - `environment: production`, `concurrency: deploy-prod`, `id-token: write`
  - 트리거
    - `push: main`(`paths: backend/**`, `deploy/**`, 이 워크플로 파일)
    - `workflow_dispatch`(`image_tag` 입력, build는 건너뜀)
  - `image_tag`가 `^[0-9a-f]{40}$` 형식인지 검증한다.
  - 스크립트를 base64로 인코딩하고, `jq`로 SSM parameters를 만든다. `executionTimeout`은 900으로 둔다.
    - SSM의 `{{ }}` 파라미터 해석과 따옴표 문제를 피하기 위해서다. 실제 해석 방식은 [확인 필요]다.
  - 결과 줄과 종료 코드를 확인한다.
  - 외부 경로가 403을 돌려주는지 확인한다. 실패하면 Nginx 쪽 문제이므로 자동 롤백 없이 워크플로를 실패로 끝낸다.
- 이미지 정리 정책
  - `docker image prune`은 태그가 없는 이미지만 지운다. 그래서 SHA 태그가 붙은 이미지는 계속 쌓인다.
  - 현재 SHA를 뺀 나머지 GHCR 태그를 `docker rmi`로 떼어 낸 뒤 `prune`을 실행한다.
  - 결과적으로 **현재 이미지(`latest`)와 직전 정상 이미지(`prev`)만 남는다.** 롤백한 경우에는 실패한 이미지를 조사용으로 남긴다.
  - 그보다 오래된 버전은 GHCR에서 다시 pull한다.
- 롤백 검증
  - 수동: `workflow_dispatch`에 직전 SHA를 넣어 실행한다.
  - 자동: 기동에 실패하는 테스트 태그로 스크립트를 실행한다(SSM 콘솔 수동 실행도 가능). `ROLLED_BACK`이 나오고, `prev`로 정상 기동하는지 확인한다.

**완료 기준**

- backend PR을 병합하면 새 SHA로 자동 기동된다.
- 두 롤백 시나리오가 모두 통과한다.
- EC2에는 이미지가 latest, prev, 조사용 이미지까지만 남는다.
- `backend.env`, uploads, truststore, Nginx는 바뀌지 않았다.

### 7단계. Flyway 도입

**선행 조건**

- 6단계 완료
- 1단계에서 Flyway 경우 A·B·C를 판정했다.
- DB 계정 방안을 정했다.
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

- PR 하나로 전체 흐름을 확인한다: CI → 병합 → GHCR → SSM → `healthy()` → 외부 검증
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
| 1 | 없음 | 없음 | 없음 (조회만) |
| 2 | `.github/workflows/ci.yml` (+선택 gradlew 모드) | main Ruleset 필수 체크 | 없음 |
| 3 | `deploy-backend.yml`(build) (+선택 Dockerfile LABEL) | GHCR 패키지 Public | 없음 |
| 4 | 없음 | Environment `production`, Variables, Secret | OIDC provider, 배포 Role, EC2 SSM Role |
| 5+6 | `deploy/ec2-deploy.sh`, `deploy-backend.yml`(deploy), `ci.yml`(`sh -n`) | 없음 | 없음 |
| 7 | `build.gradle`, `application.yaml`, `application-prod.yaml`, `db/migration/V1~`(경우 B면 V2), `ci.yml`, `docs/database.md` | 없음 | RDS 스냅샷, (계정 분리 시) 마이그레이션 계정 생성, `backend.env` 추가 (사용자 수행) |
| 8 | 문서 3개 | 없음 | 없음 |

## 5. 예상되는 기술적 문제와 해결 방안

| 문제 | 해결 방안 |
|---|---|
| CI에서 `@SpringBootTest` 2개 실패 | MySQL service와 더미 환경변수 |
| `gradlew`가 100644 | `chmod +x` 또는 Git 파일 모드 변경 |
| path 필터 때문에 필수 체크가 대기 상태로 남음 | path 필터는 배포 워크플로에만 |
| `sh`에서 `pipefail` 오류, `set -e` 때문에 롤백 전에 중단 | POSIX sh와 명시적 분기, CI에서 `sh -n` |
| 롤백도 실패 | 종료 코드 2로 구분하고, SSH로 긴급 복구 (설계 문서 12장) |
| 403만 보고 성공으로 오판 | `healthy()`의 여러 조건과 외부 검증 |
| SSM이 root로 실행됨, compose 플러그인 위치 | `sudo docker compose version`을 먼저 확인하고, 스크립트에서 `cd` |
| SSM의 `{{ }}` 해석과 따옴표 문제 | base64로 스크립트 전달 |
| GHCR 이름 대문자 | `jung-daeyoung` 소문자 |
| SHA 이미지가 쌓여 디스크 부족 | 태그를 정리한 뒤 prune (latest·prev 보존) |
| Flyway 10.x와 MySQL 8.4 호환 [확인 필요] | 7단계 CI job에서 검증 |
| Flyway baseline·V2 중복 또는 누락 | 경우 A·B·C 판정, `baseline-version` 규칙, V1 덤프 시점 고정 |
| 롤백한 이전 이미지가 새 스키마와 맞지 않음 | expand → contract. Flyway는 미래 버전을 무시한다 |
| `feature/note-ai` 병합 시 Netlify만 먼저 배포됨 | CD가 켜지고 스키마 선행 조건을 충족한 뒤에 병합 |

## 6. 운영 데이터·보안 위험

**데이터**

- RDS 백업과 삭제 방지를 **2단계 전에** 켠다.
- MySQL DDL은 롤백할 수 없다. 마이그레이션이 들어간 배포 전에는 스냅샷을 만들고, 파괴적 DDL은 따로 검토한다.
- uploads는 호스트 볼륨이다. `docker compose down -v`는 쓰지 않는다.

**보안**

- OIDC `sub`는 `environment:production`, 배포 브랜치는 main만 허용한다. `pull_request_target`은 쓰지 않는다.
- 배포 Role은 SSM 문서 하나와 인스턴스 하나로 제한한다. `packages: write`는 배포 워크플로에만 준다.
- `image_tag`를 정규식으로 검증한다. 스크립트 안에서도 한 번 더 검증한다.
- SSM 출력에는 결과 줄만 남긴다. Role ARN은 Secret에 두고, `backend.env`는 읽지도 출력하지도 않는다.
- DB 계정
  - 앱 계정은 DML만 가진다.
  - 마이그레이션 계정은 마스터 계정과 분리한다.
  - 현재 어떤 계정을 쓰는지는 [확인 필요]다.
- 공식 action만 쓰고 버전을 고정한다.

## 7. 구축 순서

1. 1단계 분석, RDS 백업·삭제 방지, Flyway 경우와 DB 계정 상태 확인
2. 2단계 CI (`ci/actions`, 운영 영향 없음)
3. 3단계 GHCR push만 (운영 영향 없음)
4. 4단계 OIDC·SSM (읽기 명령으로만 검증)
5. 5+6단계 CD와 롤백. 처음 몇 번은 `workflow_dispatch`로 실행한 뒤 `push: main`을 켠다.
6. 7단계 Flyway. 경우별 순서에 따라 진행하고, 이때 `feature/note-ai` 병합을 함께 계획한다.
7. 8단계 통합 테스트와 문서 갱신

각 단계는 별도 PR로 진행하고, 완료 기준을 확인한 뒤 다음 단계로 넘어간다.

## 다음 작업

- 사용자가 1단계 확인 명령을 EC2, AWS 콘솔, RDS, Netlify에서 실행하고 결과를 공유한다.
- 결과를 반영해 [미확인]·[확인 필요] 항목을 갱신하고, Flyway 경우(A·B·C)와 DB 계정 방안을 확정한다.
