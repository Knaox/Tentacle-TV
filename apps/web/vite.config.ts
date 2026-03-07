import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

// Injecter les deux versions (sélection à runtime via isTauriApp)
const webVersion = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")).version;
const desktopPkgPath = resolve(__dirname, "../desktop/package.json");
const desktopVersion = existsSync(desktopPkgPath)
  ? JSON.parse(readFileSync(desktopPkgPath, "utf-8")).version
  : webVersion;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION_WEB__: JSON.stringify(webVersion),
    __APP_VERSION_DESKTOP__: JSON.stringify(desktopVersion),
  },
  // Load .env files from monorepo root (where .env and .env.production live)
  envDir: resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    drop: ["debugger"],
    pure: ["console.log", "console.debug", "console.info"],
  },
  build: {
    sourcemap: false,
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
