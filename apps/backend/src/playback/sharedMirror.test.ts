/**
 * Le verrou du miroir : le résolveur de segments du backend DOIT être l'octet
 * pour octet celui de `packages/shared/src/playback/` (le backend ne dépend
 * pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/).
 * La source canonique est SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/playback/{segmentTypes,resolveSegments,\
 *      playbackSettings,segmentChapters}.ts apps/backend/src/playback/
 *
 * Même esprit que le test croisé RN ↔ CSS de packages/theme : deux mondes qui
 * ne peuvent pas s'importer, une vérité mécaniquement tenue.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";

/** La racine du dépôt, trouvée depuis le cwd (pnpm place le cwd dans le paquet). */
function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("miroir du résolveur partagé", () => {
  it.each([
    "segmentTypes.ts",
    "resolveSegments.ts",
    "playbackSettings.ts",
    "segmentChapters.ts",
    "segmentPlugins.ts",
    "frameBlocks.ts",
    "creditsFromFrames.ts",
  ])(
    "%s est identique octet pour octet à packages/shared",
    (name) => {
      const root = repoRoot();
      const canonical = readFileSync(
        join(root, "packages/shared/src/playback", name),
        "utf8",
      );
      const mirror = readFileSync(join(root, "apps/backend/src/playback", name), "utf8");
      expect(mirror).toBe(canonical);
    },
  );
});
