// La page du labo des réglages, construite en PRODUCTION avec la configuration du web (alias des
// polices, graisses des icônes, Tailwind) — seuls la racine et la sortie changent, et
// `src/main.tsx` (que des écrans importent pour `backendUrl`) cède à un bouchon : le banc ne
// démarre pas l'application.
import { resolve } from "node:path";
import { mergeConfig, type Plugin } from "vite";

import webConfig from "../../vite.config";

const MAIN = resolve(__dirname, "../../src/main.tsx");
const STUB = resolve(__dirname, "mainStub.ts");

const stubAppEntry: Plugin = {
  name: "lab-stub-app-entry",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (!importer || !/(^|\/)main$/.test(source)) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved?.id === MAIN ? STUB : null;
  },
};

export default mergeConfig(webConfig, {
  root: __dirname,
  base: "./",
  logLevel: "warn",
  plugins: [stubAppEntry],
  build: { emptyOutDir: true, sourcemap: false, rollupOptions: { output: { manualChunks: undefined } } },
});
