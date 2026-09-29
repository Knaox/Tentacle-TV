import { defineConfig } from "vitest/config";

/**
 * Les suites de compatibilité : jamais jouées par `pnpm test` (elles exigent
 * une instance Jellyfin), seulement par `run.ts`, qui prépare l'instance et
 * leur passe son contexte. Une seule instance : tout est séquentiel.
 */
export default defineConfig({
  test: {
    include: ["test/jellyfin-compat/suites/**/*.compat.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    pool: "forks",
  },
});
