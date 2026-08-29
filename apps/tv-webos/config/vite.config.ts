import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { substitutionModules } from "./substitutionModules";
import { serveHarness } from "./serveHarness";
import { inlineStyleGuard } from "./inlineStyleGuard";
import { SUBSTITUTED_PACKAGES, SUBSTITUTED_FILES } from "./substitutionTable";
import { OPTIONS_LEGACY, BROWSER_BASELINE } from "./legacy";
import { chrome53Compat } from "./postcss";

/**
 * Variante de build du client, pour un téléviseur LG.
 *
 * Elle ne compile pas d'interface qui lui soit propre : la source reste
 * `apps/web/src`. Ce fichier décrit uniquement ce qui change — le socle du
 * moteur, les modules substitués, et le chemin sous lequel le serveur la sert.
 */

const TARGET = resolve(__dirname, "..");
const REPO = resolve(TARGET, "../..");
const WEB = resolve(TARGET, "../web");

const versions = JSON.parse(readFileSync(resolve(REPO, "versions.json"), "utf-8"));

export default defineConfig({
  root: resolve(TARGET, "client"),
  // Le serveur Tentacle sert cette variante sous `/tv`. Le routeur porte le
  // même préfixe en `basename` — les deux doivent rester alignés.
  base: "/tv/",
  envDir: REPO,

  // Serveur de développement, et rien d'autre : la production ne le voit jamais.
  //
  // En production le backend sert lui-même cette variante — même origine, appels
  // relatifs, cookie de session same-site. Ici les deux sont séparés, et le proxy
  // rétablit cette origine unique : sans lui, le `/api/jellyfin` relatif de
  // `shims/appContext.ts` partirait sur le port de Vite, où rien n'écoute.
  //
  // Un port distinct de celui du client web (5174) pour que les deux tournent
  // ensemble : sur cette cible on compare en permanence ce que le téléviseur
  // rend à ce que le navigateur rend.
  //
  // **Ce serveur ne remplace pas le build.** Les passes PostCSS de
  // `config/postcss/` et `@vitejs/plugin-legacy` ne s'exécutent qu'à la
  // construction : une primitive trop récente pour Chrome 53 passe ici sans un
  // mot et fait échouer le build. Itérer ici, valider par `pnpm build`.
  server: {
    port: 5175,
    strictPort: true,
    host: "0.0.0.0",
    proxy: {
      // Déclaré avant `/api`, sinon la règle la plus large l'emporte et la
      // connexion WebSocket est proxifiée en HTTP.
      "/api/ws": { target: "ws://localhost:3001", ws: true },
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },

  plugins: [
    substitutionModules(SUBSTITUTED_FILES),
    // Avant `react()` : le `transform` doit voir la source TSX, pas sa
    // traduction. Et après la substitution, pour ne juger que les modules
    // réellement embarqués.
    inlineStyleGuard(),
    // Le banc d'essai du moteur de focus, hors du dossier public pour ne
    // jamais atteindre un téléviseur d'utilisateur.
    serveHarness(resolve(TARGET, "harness")),
    react(),
    legacy(OPTIONS_LEGACY),
  ],

  define: {
    __APP_VERSION_WEB__: JSON.stringify(versions.webos ?? versions.server),
    __APP_VERSION_DESKTOP__: JSON.stringify(versions.desktop),
    __MIN_SERVER_VERSION__: JSON.stringify(versions.minServer ?? "1.3.0"),
    __DIST_CHANNEL__: JSON.stringify("webos"),
    // Le panneau de diagnostic du lecteur n'est jamais embarqué : il est
    // pensé pour une souris et pèse pour rien dans un bundle de téléviseur.
    __PLAYER_DEBUG__: JSON.stringify(false),
    // La surcouche de vérification du focus. Figée à faux sauf demande
    // explicite : l'élimination de code mort emporte alors l'appel
    // d'installation, la surcouche et ses règles, et rien de tout cela ne pèse
    // dans le fragment servi à un téléviseur.
    //
    //   TENTACLE_TV_DEBUG=1 pnpm --filter @tentacle-tv/tv-webos build
    __TV_DEBUG__: JSON.stringify(process.env.TENTACLE_TV_DEBUG === "1"),
  },

  resolve: {
    alias: {
      // `apps/web` s'importe lui-même par `@/…` ; la racine de Vite étant
      // `client/`, l'alias doit continuer de désigner les sources du web.
      "@": resolve(WEB, "src"),
      ...SUBSTITUTED_PACKAGES,
    },
  },

  css: {
    // Déclarée en ligne, ce qui court-circuite la découverte de
    // `apps/web/postcss.config.js` : ce fichier-là sert le build web de
    // production et ne doit rien savoir du téléviseur.
    postcss: {
      plugins: [
        // Passée par chemin et non par objet : la configuration importe le
        // preset partagé, qui est du TypeScript à imports sans extension. Le
        // chargeur ESM de Node, qui évalue ce fichier-ci, ne sait pas les
        // résoudre — celui de Tailwind, si.
        tailwindcss(resolve(TARGET, "config/tailwind.config.ts")),
        // Sans cette liste, autoprefixer travaille sur ses valeurs par défaut
        // — des navigateurs récents — et n'émet aucun des préfixes dont un
        // moteur de 2016 a encore besoin.
        autoprefixer({ overrideBrowserslist: BROWSER_BASELINE }),
        chrome53Compat(),
      ],
    },
  },

  esbuild: {
    drop: ["debugger"],
    pure: ["console.log", "console.debug", "console.info"],
  },

  build: {
    target: ["chrome53"],
    sourcemap: false,
    emptyOutDir: true,
    // Seuil assumé, pas contourné. Le fragment d'entrée pèse environ 600 ko
    // une fois transpilé pour SystemJS : c'est le code applicatif partagé par
    // tous les écrans — routeur, disposition, client d'API, thème —, que
    // découper ne ferait que fragmenter sans rien retirer du démarrage.
    //
    // C'est aussi le point à mesurer en premier sur un appareil réel : sur le
    // processeur d'un téléviseur de 2018, c'est l'analyse de ce fragment qui
    // décide du délai avant le premier écran. Si le délai est intenable, le
    // levier n'est pas le découpage mais le socle — Chrome 79 supprimerait
    // SystemJS et une partie de core-js.
    chunkSizeWarningLimit: 700,
    // Le découpage du client web isole `framer-motion` dans son propre
    // fragment ; ici il est remplacé par un shim de quelques lignes, et le
    // fragment ne vaudrait plus qu'une requête HTTP pour rien.
    //
    // En revanche l'internationalisation et les icônes sont sorties du
    // fragment d'entrée, ce que le client web ne fait pas : sur le processeur
    // d'une dalle, c'est le temps d'analyse du JavaScript qui décide de la
    // durée avant le premier écran, et un fragment de six cents kilo-octets
    // s'y analyse en secondes, pas en millisecondes.
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-i18n": ["i18next", "react-i18next"],
          "vendor-icones": ["lucide-react"],
        },
      },
    },
  },
});
