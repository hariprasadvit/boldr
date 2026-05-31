import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: proxy /api to the FastAPI backend (single-origin in prod where FastAPI serves the build).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  // Build straight into the backend's default STATIC_DIR so FastAPI serves the
  // SPA single-origin out of the box. Override VITE_OUT_DIR for other layouts.
  build: {
    // Single-process deploy: build into the backend's STATIC_DIR so FastAPI
    // serves the SPA same-origin. Override VITE_OUT_DIR for other layouts.
    outDir: process.env.VITE_OUT_DIR ?? "../backend/static",
    emptyOutDir: true,
  },
});
