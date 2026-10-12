import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // index.html CSP(connect-src/img-src)의 백엔드 origin을 client.js와 같은 VITE_API_BASE_URL로 맞춘다.
  // 값이 없으면(로컬 개발) index.html의 http://localhost:8080을 그대로 둔다.
  const apiBaseUrl = loadEnv(mode, ".", "VITE_").VITE_API_BASE_URL
  const cspApiOrigin = {
    name: "csp-api-origin",
    transformIndexHtml: (html) =>
      apiBaseUrl ? html.replaceAll("http://localhost:8080", new URL(apiBaseUrl).origin) : html,
  }

  return {
    plugins: [react(), tailwindcss(), cspApiOrigin],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
      globals: true,
    },
  }
})
