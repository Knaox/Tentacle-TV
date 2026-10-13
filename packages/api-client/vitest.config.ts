import { createRequire } from "node:module";
import { dirname } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Deux écarts aux défauts de vitest.
 *
 * Les délais : plusieurs fichiers rechargent leur module dans `beforeEach`
 * (`vi.resetModules` puis `await import(…)`, cf. `tentacleSocket`,
 * `bitrateMeasure`) : la transformation tombe dans le délai du crochet (10 s
 * par défaut) ou du test (5 s). Sur une machine chargée — crochet pre-push à
 * côté d'autres sessions — ils échouaient sans rien avoir vérifié.
 *
 * UN SEUL React : le dépôt en installe plusieurs copies — celle du paquet
 * (`node_modules/react`, pour ses types), celle de la racine (que prend
 * `react-dom`), celle que `@tanstack/react-query` garde pour lui. Un crochet
 * monté en test (`createRoot`, cf. reco/useRecoPageVisit.test.ts) les
 * mélangeait : « Invalid hook call ». Les tests résolvent donc `react` comme
 * `react-dom`, et TanStack passe par Vite (`inline`) pour suivre l'alias. Le
 * code livré n'en dépend pas : le bundler de chaque application n'a qu'un React.
 */
const require = createRequire(import.meta.url);
const reactDom = dirname(require.resolve("react-dom/package.json"));
const react = dirname(createRequire(`${reactDom}/`).resolve("react/package.json"));

export default defineConfig({
  resolve: {
    alias: [{ find: /^react(\/.*)?$/, replacement: `${react}$1` }],
  },
  test: {
    testTimeout: 20_000,
    hookTimeout: 30_000,
    server: { deps: { inline: [/@tanstack\/react-query/] } },
  },
});
