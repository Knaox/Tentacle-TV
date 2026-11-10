// La page du labo du hors ligne, construite en PRODUCTION avec la configuration du web (alias des
// polices, graisses des icônes, Tailwind) — seuls la racine et la sortie changent, et le
// démarrage de l'application (`src/main.tsx`) est remplacé par un bouchon : ses modules n'y
// lisent que l'adresse du serveur.
import { resolve, sep } from "node:path";
import { mergeConfig, type Plugin } from "vite";

import webConfig from "../../vite.config";

const SRC = resolve(__dirname, "../../src") + sep;
const MAIN = resolve(SRC, "main");

/** `src/main.tsx` importé par un module de l'application → le bouchon du banc. */
function stubAppMain(): Plugin {
  return {
    name: "hors-ligne-lab-main-stub",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer || !importer.startsWith(SRC) || !/^(\.\.?\/)+main$/.test(source)) return null;
      return resolve(importer, "..", source) === MAIN ? resolve(__dirname, "mainStub.ts") : null;
    },
  };
}

export default mergeConfig(webConfig, {
  root: __dirname,
  base: "./",
  logLevel: "warn",
  plugins: [stubAppMain()],
  build: { emptyOutDir: true, sourcemap: false, rollupOptions: { output: { manualChunks: undefined } } },
});
