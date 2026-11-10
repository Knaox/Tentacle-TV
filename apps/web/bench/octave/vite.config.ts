// La page du labo d'Octave, construite en PRODUCTION avec la configuration du web (alias des
// polices, graisses des icônes, Tailwind) — seuls la racine et la sortie changent. Les images
// (`img/`) ne sont pas dans `public/` : `capture.mjs` les sert à côté de la page. Aucun fichier
// d'environnement n'est lu (`envDir` : ce dossier) : la page ne connaît aucun vrai serveur.
import { resolve } from "node:path";
import { mergeConfig, type Plugin } from "vite";

import webConfig from "../../vite.config";

const APP_ENTRY = resolve(__dirname, "../../src/main.tsx");
const APP_ENTRY_STUB = resolve(__dirname, "appEntryStub.ts");

/**
 * `src/main.tsx` est le point d'entrée de l'application : importé par un module d'Octave (pour
 * `backendUrl`), il s'exécuterait en entier dans la page du banc. On lui substitue son bouchon.
 */
function stubAppEntry(): Plugin {
  return {
    name: "octave-bench-stub-app-entry",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (!importer || !/(^|\/)main(\.tsx)?$/.test(source)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved?.id === APP_ENTRY ? APP_ENTRY_STUB : null;
    },
  };
}

export default mergeConfig(webConfig, {
  root: __dirname,
  envDir: __dirname,
  base: "./",
  publicDir: false,
  logLevel: "error",
  plugins: [stubAppEntry()],
  build: { emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 20_000, rollupOptions: { output: { manualChunks: undefined } } },
});
