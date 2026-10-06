import { defineConfig } from "vitest/config";

/**
 * Le seul écart aux défauts de vitest : les délais.
 *
 * Plusieurs fichiers rechargent leur module dans `beforeEach` (`vi.resetModules`
 * puis `await import(…)`, cf. `tentacleSocket`, `bitrateMeasure`) : la
 * transformation tombe dans le délai du crochet (10 s par défaut) ou du test
 * (5 s). Sur une machine chargée — crochet pre-push à côté d'autres sessions —
 * ils échouaient sans rien avoir vérifié.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
