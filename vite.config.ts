import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_TARGET || "http://127.0.0.1:8021";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      port: 5173,
      // Proxying keeps the SPA same-origin with the API in development, so the
      // auth cookies behave exactly as they will in production behind one host.
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});
