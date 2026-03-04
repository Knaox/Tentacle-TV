import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync } from "fs";

// Injecter les deux versions (sélection à runtime via isTauriApp)
const webVersion = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")).version;
const desktopVersion = JSON.parse(readFileSync(resolve(__dirname, "../desktop/package.json"), "utf-8")).version;

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
