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
    // Les outils de mesure (`scripts/releve/`) portent leurs propres fonctions
    // pures : les laisser hors du filet reviendrait à déboguer l'instrument en
    // même temps que ce qu'il mesure.
    // `config/` y entre aussi : les quatorze passes PostCSS décident de toute
    // la mise en page du portage et n'avaient AUCUN test. Une passe est une
    // fonction pure d'un arbre CSS vers un autre — le sujet le plus testable
    // du dépôt, et le seul qu'on ne pouvait vérifier qu'en construisant.
    // `installateur/` enfin : il part chez des gens qui n'ont pas ce dépôt, et
    // sa seule panne possible ne se voit qu'à l'exécution, chez eux.
    include: [
      "client/src/**/*.test.ts",
      "config/**/*.test.ts",
      "scripts/**/*.test.mjs",
      "installateur/**/*.test.mjs",
    ],
  },
});
