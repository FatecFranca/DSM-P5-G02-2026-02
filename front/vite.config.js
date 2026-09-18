import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Desenvolvimento usa a API Azure por padrão.
  // Para backend local, configure explicitamente:
  // VITE_PROXY_TARGET=http://127.0.0.1:3000
  const proxyTarget = env.VITE_PROXY_TARGET?.trim() || "http://158.158.48.119";
  const proxy = {
    "/api": { target: proxyTarget, changeOrigin: true },
    "/health": { target: proxyTarget, changeOrigin: true },
  };

  return {
    plugins: [react()],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
      coverage: {
        provider: "v8",
        reporter: ["text", "html", "lcov"],
        include: ["src/**/*.{js,jsx}"],
        exclude: ["src/**/*.test.{js,jsx}", "src/test/**", "src/main.jsx"],
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
      proxy,
    },
  };
});
