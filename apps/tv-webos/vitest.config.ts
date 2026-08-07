import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Configuration des tests de la cible téléviseur.
 *
 * Séparée de `config/vite.config.ts`, et volontairement minuscule : celui-ci
 * pose un `root` dans `client/`, quatre greffons, quatorze passes PostCSS et la
 * substitution de modules. Rien de tout cela n'a de sens pour des fonctions
 * pures, et le faire tourner pour trois assertions coûterait plusieurs secondes
 * à chaque exécution.
 *
 * Le seul emprunt nécessaire est l'alias `@`. Sans lui, tout module de cette
 * cible qui importe une brique d'`apps/web` — au premier rang desquels le profil
 * d'appareil, qui compose celles de `lib/deviceProfile/blocs` — est intestable :
 * vitest cherche alors un paquet npm nommé `@`, et échoue avant d'avoir collecté
 * le moindre test.
 */

const CIBLE = __dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(CIBLE, "../web/src"),
    },
  },
  test: {
    include: ["client/src/**/*.test.ts"],
  },
});
