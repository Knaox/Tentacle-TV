// Le labo du lecteur, construit en PRODUCTION avec la configuration du web (alias des polices,
// graisses des icônes, Tailwind) — seuls la racine, la sortie et `main.tsx` changent : les
// modules du lecteur importent `backendUrl` de `src/main.tsx`, qui démarre toute l'application.
import { resolve } from "node:path";
import { mergeConfig, type Plugin } from "vite";

import webConfig from "../../vite.config";

const APP_MAIN = resolve(__dirname, "../../src/main.tsx");
const MAIN_STUB = resolve(__dirname, "mainStub.ts");

const mainStub: Plugin = {
  name: "lecteur-lab-main-stub",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (!importer || !/\/main$/.test(source)) return null;
    const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
    return resolved?.id === APP_MAIN ? MAIN_STUB : null;
  },
};

export default mergeConfig(webConfig, {
  root: __dirname,
  base: "./",
  logLevel: "warn",
  plugins: [mainStub],
  build: { emptyOutDir: true, sourcemap: false, rollupOptions: { output: { manualChunks: undefined } } },
});
