# UniNote Frontend

React + Vite 프론트엔드. 백엔드(Spring Boot, 기본 `http://localhost:8080`)가 떠 있어야 한다.

```powershell
npm install
npm run dev      # http://localhost:5173
npm run lint
npm run build
npm run test
```

배포 환경의 백엔드 주소는 `.env.example`을 참고해 `VITE_API_BASE_URL`로 지정한다.
