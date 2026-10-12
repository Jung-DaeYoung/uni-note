# P3-7. JWT httpOnly 쿠키 전환 재평가

`PLANS.md`의 `P3-7`은 "실제 필요성(위협 모델, 운영 환경)을 재확인한 뒤 착수한다 — 근거 없이 아키텍처를 바꾸지 않는다"고 명시하고 있다. 아래는 그 재평가 결과이며, 코드 변경 없이 문서화만 진행한다.

## 현재 상태

- JWT는 `localStorage`에 저장되고(`frontend/src/context/AuthContext.jsx`), Axios interceptor(`frontend/src/api/client.js`)가 매 요청마다 `Authorization: Bearer <token>` 헤더로 첨부한다.
- `P1-5`(단기 완화책)에서 토큰 만료 클라이언트 검증, 로그아웃 경로 단일화 등은 이미 별도로 다뤄진다.

## 위협 모델

- **노출 경로**: XSS가 발생하면 `localStorage`의 토큰을 스크립트가 직접 읽어갈 수 있다. 현재 이 프로젝트는 Tiptap 에디터에 사용자 생성 콘텐츠를 렌더링하므로 XSS 표면이 존재하지만, Tiptap의 스키마 기반 렌더링(임의 HTML 삽입이 아닌 JSON 문서 구조)이 원시 HTML 주입보다 위험을 낮춘다.
- **httpOnly 쿠키 전환 시 추가로 필요한 것**: 쿠키는 브라우저가 자동으로 첨부하므로 CSRF 방어(예: double-submit 쿠키, `SameSite=Strict/Lax` 조합, CSRF 토큰 검증 미들웨어)가 반드시 함께 도입되어야 한다. 이는 인증 흐름 전체(로그인 응답 형식, 프론트 Axios interceptor, 백엔드 `SecurityConfig`/`JwtFilter`)를 다시 설계해야 하는 별도 아키텍처 변경이다.
- **CORS/배포 환경**: 쿠키 기반 인증은 프론트·백엔드가 다른 origin에 배포될 경우 `SameSite`, `Secure`, CORS `credentials` 설정을 정교하게 맞춰야 하며, 현재 `P1-4`에서 다루는 환경별 CORS 설정과도 맞물린다.

## 결론

- 근본적인 XSS 내성은 httpOnly 쿠키 전환으로만 얻을 수 있는 것이 사실이지만, 이 프로젝트의 현재 배포 규모(단일 팀 프로젝트, 제한된 사용자)와 이미 적용된 완화책(`P1-5`)을 고려하면 CSRF 대응까지 포함한 전면 재설계에 들어가는 비용 대비 우선순위가 낮다.
- **현재 착수하지 않는다.** 다음 조건 중 하나가 충족되면 재검토한다:
  - 외부 사용자에게 공개 배포되어 XSS 공격 표면이 실질적으로 커지는 경우
  - Tiptap 콘텐츠 렌더링 경로에 원시 HTML 삽입이 허용되는 기능이 추가되는 경우
  - 인증 아키텍처를 어차피 재작업해야 하는 다른 계기(예: OAuth 연동, 다중 디바이스 세션 관리)가 생기는 경우
