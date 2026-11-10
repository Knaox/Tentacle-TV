import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

/**
 * Les tests lisent la configuration de Vite, plus une précision : les icônes Phosphor passent
 * par Vite au lieu d'être confiées telles quelles à Node.
 *
 * `node-linker=hoisted` pose, à côté de chaque paquet qui dépend de React, SA copie de React
 * (celle de la racine est la 19.1 de React Native). Le build n'en garde qu'une
 * (`resolve.dedupe`, posé par @vitejs/plugin-react) ; mais Vitest laisse Node charger tout
 * paquet ESM bien formé, et Node résout alors `react` depuis le dossier du paquet — une
 * SECONDE instance, dont les crochets n'ont pas de répartiteur (« Cannot read properties of
 * null (reading 'useContext') » au premier rendu d'une icône). En ligne, le dédoublonnage
 * vaut aussi pour lui.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      server: { deps: { inline: [/@phosphor-icons\/react/] } },
    },
  }),
);
