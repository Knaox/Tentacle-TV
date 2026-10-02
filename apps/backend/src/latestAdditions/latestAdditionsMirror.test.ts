/**
 * Le verrou du miroir des « Derniers ajouts » : le champ que le proxy joint à
 * une carte regroupée DOIT être l'octet pour octet celui de
 * `packages/shared/src/latestAdditions/latestAdditionsTypes.ts` (le backend ne
 * dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans
 * packages/). La source canonique est SHARED ; on modifie là-bas, on recopie
 * ici :
 *
 *   cp packages/shared/src/latestAdditions/latestAdditionsTypes.ts apps/backend/src/latestAdditions/
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("miroir des derniers ajouts", () => {
  it("latestAdditionsTypes.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/latestAdditions/latestAdditionsTypes.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/latestAdditions/latestAdditionsTypes.ts"), "utf8"));
  });
});
