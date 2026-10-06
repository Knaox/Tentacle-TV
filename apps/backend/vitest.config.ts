import { defineConfig } from "vitest/config";

/**
 * Le seul écart aux défauts de vitest : le délai d'un test.
 *
 * Les bancs de sécurité de la Famille hachent et vérifient le PIN plusieurs fois
 * par test (fonction volontairement lente). Sur une machine chargée — crochet
 * pre-push à côté d'autres sessions — ils passaient les 5 s par défaut et
 * échouaient sans rien avoir vérifié. 20 s couvrent ce coût.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
  },
});
