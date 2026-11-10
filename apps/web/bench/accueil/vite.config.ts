// La page du banc de l'accueil, construite en PRODUCTION avec la configuration du web (alias des
// polices, graisses des icônes, Tailwind) — seuls la racine et la sortie changent.
import { resolve } from "node:path";

import { mergeConfig, type Plugin } from "vite";

import webConfig from "../../vite.config";

/**
 * Une douzaine de modules lisent `backendUrl` dans l'entrée de l'application (`src/main.tsx`) :
 * les importer la ferait entrer dans le banc, où elle DÉMARRERAIT l'application entière sur la
 * même racine (constaté : l'assistant d'installation à la place de la coquille). Le banc leur
 * rend un module qui n'exporte que cela.
 */
function appEntryStub(): Plugin {
  const entry = resolve(__dirname, "../../src/main.tsx");
  const stub = resolve(__dirname, "appEntryStub.ts");
  return {
    name: "bench-app-entry-stub",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || !/(^|\/)main$/.test(source)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved?.id === entry ? stub : null;
    },
  };
}

export default mergeConfig(webConfig, {
  root: __dirname,
  base: "./",
  logLevel: "warn",
  plugins: [appEntryStub()],
  build: { emptyOutDir: true, sourcemap: false, rollupOptions: { output: { manualChunks: undefined } } },
});
