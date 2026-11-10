// La page du labo du socle, construite en PRODUCTION avec la configuration du web (alias des
// polices, graisses des icônes, Tailwind) — seuls la racine et la sortie changent.
import { mergeConfig } from "vite";

import webConfig from "../../vite.config";

export default mergeConfig(webConfig, {
  root: __dirname,
  base: "./",
  logLevel: "warn",
  build: { emptyOutDir: true, sourcemap: false, rollupOptions: { output: { manualChunks: undefined } } },
});
