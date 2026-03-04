import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync } from "fs";

// Lire la version selon le contexte de build (Tauri desktop vs web)
const isTauriBuild = !!process.env.TAURI_ENV_PLATFORM;
const pkgPath = isTauriBuild
  ? resolve(__dirname, "../desktop/package.json")
  : resolve(__dirname, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const appVersion = pkg.version;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  // Load .env files from monorepo root (where .env and .env.production live)
  envDir: resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
