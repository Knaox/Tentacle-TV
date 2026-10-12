// Les tests de l'hôte (`src/`) et des scripts d'empaquetage (`scripts/`),
// jamais ceux d'un paquet assemblé pour essai dans `scratch/` (il embarque le
// `dist/` du serveur, tests compilés compris).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mts"],
  },
});
