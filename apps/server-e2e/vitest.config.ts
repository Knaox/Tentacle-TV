import { defineConfig } from "vitest/config";

/**
 * Le banc de bout en bout : de vraies piles Docker, un vrai Jellyfin, le Chrome
 * du système. Lent par nature — une pile à la fois, de longues échéances.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.e2e.ts"],
    testTimeout: 4 * 60_000,
    hookTimeout: 10 * 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
