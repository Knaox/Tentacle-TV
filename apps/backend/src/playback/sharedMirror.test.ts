/**
 * Le verrou des miroirs : le résolveur de segments ET les familles de
 * plateformes du backend DOIVENT être l'octet pour octet ceux de
 * `packages/shared/src/` (le backend ne dépend pas de `@tentacle-tv/shared` —
 * tsc CommonJS, image Docker sans packages/). La source canonique est SHARED ;
 * on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/playback/{segmentTypes,resolveSegments,\
 *      playbackSettings,segmentChapters}.ts apps/backend/src/playback/
 *   cp packages/shared/src/platforms.ts apps/backend/src/services/tmdb/
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

const PLAYBACK_FILES = [
  "segmentTypes.ts",
  "resolveSegments.ts",
  "playbackSettings.ts",
  "segmentChapters.ts",
  "segmentPlugins.ts",
  "frameBlocks.ts",
  "creditsFromFrames.ts",
  "claimGuards.ts",
  "sceneChecks.ts",
];

/** Paires [canonique, miroir], relatives à la racine du dépôt. */
const MIRRORS: Array<[string, string]> = [
  ...PLAYBACK_FILES.map(
    (name): [string, string] => [`packages/shared/src/playback/${name}`, `apps/backend/src/playback/${name}`]
  ),
  ["packages/shared/src/platforms.ts", "apps/backend/src/services/tmdb/platforms.ts"],
];

describe("miroirs de packages/shared", () => {
  it.each(MIRRORS)("%s est identique octet pour octet à %s", (canonicalPath, mirrorPath) => {
    const root = repoRoot();
    const canonical = readFileSync(join(root, canonicalPath), "utf8");
    const mirror = readFileSync(join(root, mirrorPath), "utf8");
    expect(mirror).toBe(canonical);
  });
});
