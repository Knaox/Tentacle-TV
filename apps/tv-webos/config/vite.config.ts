import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { substitutionModules } from "./substitutionModules";
import { PAQUETS_SUBSTITUES, FICHIERS_SUBSTITUES } from "./tableSubstitutions";
import { OPTIONS_LEGACY, SOCLE_NAVIGATEUR } from "./legacy";
import { compatibiliteChrome53 } from "./postcss";

/**
 * Variante de build du client, pour un téléviseur LG.
 *
 * Elle ne compile pas d'interface qui lui soit propre : la source reste
 * `apps/web/src`. Ce fichier décrit uniquement ce qui change — le socle du
 * moteur, les modules substitués, et le chemin sous lequel le serveur la sert.
 */

const CIBLE = resolve(__dirname, "..");
const DEPOT = resolve(CIBLE, "../..");
const WEB = resolve(CIBLE, "../web");

const versions = JSON.parse(readFileSync(resolve(DEPOT, "versions.json"), "utf-8"));

export default defineConfig({
  root: resolve(CIBLE, "client"),
  // Le serveur Tentacle sert cette variante sous `/tv`. Le routeur porte le
  // même préfixe en `basename` — les deux doivent rester alignés.
  base: "/tv/",
  envDir: DEPOT,

  plugins: [
    substitutionModules(FICHIERS_SUBSTITUES),
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
  },

  resolve: {
    alias: {
      // `apps/web` s'importe lui-même par `@/…` ; la racine de Vite étant
      // `client/`, l'alias doit continuer de désigner les sources du web.
      "@": resolve(WEB, "src"),
      ...PAQUETS_SUBSTITUES,
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
        tailwindcss(resolve(CIBLE, "config/tailwind.config.ts")),
        // Sans cette liste, autoprefixer travaille sur ses valeurs par défaut
        // — des navigateurs récents — et n'émet aucun des préfixes dont un
        // moteur de 2016 a encore besoin.
        autoprefixer({ overrideBrowserslist: SOCLE_NAVIGATEUR }),
        compatibiliteChrome53(),
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
    // Le découpage du client web isole `framer-motion` dans son propre
    // fragment ; ici il est remplacé par un shim de quelques lignes, et le
    // fragment ne vaudrait plus qu'une requête HTTP pour rien.
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
});
