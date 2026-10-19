/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 部署到子路径（如 GitHub Pages 的 /earth-timeline/）时由 CI 设置 VITE_BASE；静态数据经 import.meta.env.BASE_URL 加载
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
