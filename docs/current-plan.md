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
