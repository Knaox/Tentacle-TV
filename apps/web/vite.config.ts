import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { createRequire } from "module";

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

// Le dossier qui porte les polices embarquées, quel que soit l'endroit où le
// gestionnaire de paquets a posé le paquet. Voir l'alias, plus bas.
const fontsourceDir = dirname(
  dirname(createRequire(__filename).resolve("@fontsource-variable/inter/package.json")),
);

// Canal de distribution. "appstore" est injecté par le build Mac App Store
// (VITE_DIST_CHANNEL=appstore) → bascule la détection de MAJ vers l'App Store.
const distChannel = process.env.VITE_DIST_CHANNEL ?? "";

/**
 * Retire la balise CSP d'`index.html` pour le build Electron.
 *
 * Cette balise est héritée de Tauri — on y lit encore `http://ipc.localhost`
 * et `ipc:`. Sous Electron, la politique arrive par EN-TÊTE HTTP depuis le
 * processus principal, et deux politiques qui coexistent s'appliquent par
 * INTERSECTION : la plus stricte de chaque directive gagne. L'en-tête, écrit
 * pour ce moteur, se retrouvait donc borné par une politique écrite pour un
 * autre — sans que rien ne le signale.
 *
 * Conditionné à `TENTACLE_SHELL=electron` : les builds Tauri et web sortent
 * identiques à l'octet près. L'app Tauri livre encore macOS et Linux, et sa
 * CSP à elle vit dans `tauri.conf.json`.
 */
function stripCspMetaForElectron() {
  return {
    name: "tentacle-strip-csp-meta",
    transformIndexHtml(html: string): string {
      if (process.env.TENTACLE_SHELL !== "electron") return html;
      return html.replace(
        /\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i,
        "",
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), stripCspMetaForElectron()],
  define: {
    __APP_VERSION_WEB__: JSON.stringify(webVersion),
    __APP_VERSION_DESKTOP__: JSON.stringify(desktopVersion),
    // Version serveur MINIMALE requise par ce client (bannière de compat admin).
    __MIN_SERVER_VERSION__: JSON.stringify(versions.minServer ?? "1.3.0"),
    __DIST_CHANNEL__: JSON.stringify(distChannel),
    // Panneau de diagnostic du lecteur. L'app Electron sert un build de
    // PRODUCTION même en développement — `import.meta.env.DEV` y vaut donc
    // faux et ne peut pas servir de garde. On passe par un drapeau explicite,
    // posé par `build:web:debug` et par lui seul : aucun build livré ne
    // l'active, et le panneau disparaît alors du bundle.
    __PLAYER_DEBUG__: JSON.stringify(process.env.TENTACLE_DEBUG === "1"),
  },
  // Load .env files from monorepo root (where .env and .env.production live)
  envDir: resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      // ⚠️ Les `url()` d'une feuille CSS ne passent PAS par la résolution des
      // paquets : un nom nu y reste une adresse, écrite telle quelle dans le
      // CSS bâti. Nos sept `@font-face` (`theme/fonts.css`) demandaient donc
      // `/assets/@fontsource-variable/…woff2`, que rien ne sert — la coquille
      // y répondait par `index.html`, d'où « OTS parsing error: invalid
      // sfntVersion » (les quatre octets de `<!DO`) et Inter jamais chargée,
      // sans que rien d'autre ne le signale. L'alias rend le nom résolvable :
      // Vite copie alors les fichiers dans `assets/` et réécrit les adresses.
      //
      // Le chemin est RÉSOLU, pas écrit : `node-linker=hoisted` (`.npmrc`)
      // hisse les paquets à la racine du dépôt, un `./node_modules/…` d'ici
      // ne désignerait rien.
      "@fontsource-variable": fontsourceDir,
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
