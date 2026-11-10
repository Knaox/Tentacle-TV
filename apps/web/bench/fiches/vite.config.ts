// La page du labo des fiches, construite en PRODUCTION avec la configuration du web (alias des
// polices, graisses des icônes, Tailwind) — seuls la racine et la sortie changent, et
// l'amorçage de l'application (`src/main.tsx`) est remplacé par ses seuls exports.
import { resolve } from "node:path";
import { mergeConfig, type Plugin } from "vite";

import webConfig from "../../vite.config";

const APP_MAIN = resolve(__dirname, "../../src/main.tsx");

const appMainStub: Plugin = {
  name: "fiches-lab-app-main",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (!importer || !/(^|\/)main$/.test(source)) return null;
    const found = await this.resolve(source, importer, { ...options, skipSelf: true });
    return found?.id === APP_MAIN ? resolve(__dirname, "appMain.ts") : null;
  },
};

export default mergeConfig(webConfig, {
  root: __dirname,
  base: "./",
  logLevel: "error",
  plugins: [appMainStub],
  build: { emptyOutDir: true, sourcemap: false, rollupOptions: { output: { manualChunks: undefined } } },
});
