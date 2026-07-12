import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

// Injecter les deux versions (sélection à runtime via isTauriApp).
// Source unique : versions.json à la racine du monorepo — le web est livré
// par l'image serveur (version `server`), le fallback desktop suit `desktop`.
const versionsPath = resolve(__dirname, "../../versions.json");
const versions = existsSync(versionsPath)
  ? JSON.parse(readFileSync(versionsPath, "utf-8"))
  : {};
const webVersion = versions.server
  ?? JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")).version;
const desktopVersion = versions.desktop ?? webVersion;

// Canal de distribution. "appstore" est injecté par le build Mac App Store
// (VITE_DIST_CHANNEL=appstore) → bascule la détection de MAJ vers l'App Store.
const distChannel = process.env.VITE_DIST_CHANNEL ?? "";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION_WEB__: JSON.stringify(webVersion),
    __APP_VERSION_DESKTOP__: JSON.stringify(desktopVersion),
    // Version serveur MINIMALE requise par ce client (bannière de compat admin).
    __MIN_SERVER_VERSION__: JSON.stringify(versions.minServer ?? "1.3.0"),
    __DIST_CHANNEL__: JSON.stringify(distChannel),
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
    port: 5174,
    strictPort: true,
    host: "0.0.0.0", // accessible depuis le LAN (mobile, autres appareils)
    proxy: {
      "/api/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
