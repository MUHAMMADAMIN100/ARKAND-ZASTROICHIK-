import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Дев-прокси: фронт зовёт /api, Vite проксирует на локальный бэкенд.
// В проде базовый URL берётся из VITE_API_URL (домен Railway + /api).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
