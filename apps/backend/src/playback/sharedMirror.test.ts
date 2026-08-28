/**
 * Le verrou du miroir : le résolveur de segments du backend DOIT être l'octet
 * pour octet celui de `packages/shared/src/playback/` (le backend ne dépend
 * pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/).
 * La source canonique est SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/playback/{segmentTypes,resolveSegments}.ts \
 *      apps/backend/src/playback/
 *
 * Même esprit que le test croisé RN ↔ CSS de packages/theme : deux mondes qui
 * ne peuvent pas s'importer, une vérité mécaniquement tenue.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";

/** La racine du dépôt, trouvée depuis le cwd (pnpm place le cwd dans le paquet). */
function racineDepot(): string {
  let dossier = process.cwd();
  while (!existsSync(join(dossier, "pnpm-workspace.yaml"))) {
    const parent = dirname(dossier);
    if (parent === dossier) throw new Error("racine du dépôt introuvable");
    dossier = parent;
  }
  return dossier;
}

describe("miroir du résolveur partagé", () => {
  it.each(["segmentTypes.ts", "resolveSegments.ts", "playbackSettings.ts"])(
    "%s est identique octet pour octet à packages/shared",
    (nom) => {
      const racine = racineDepot();
      const canonique = readFileSync(
        join(racine, "packages/shared/src/playback", nom),
        "utf8",
      );
      const miroir = readFileSync(join(racine, "apps/backend/src/playback", nom), "utf8");
      expect(miroir).toBe(canonique);
    },
  );
});
