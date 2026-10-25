/**
 * Le verrou du miroir d'« Accès à Octave » : le contrat DOIT être l'octet pour
 * octet celui de `packages/shared/src/octaveRights/` (le backend ne dépend pas
 * de `@tentacle-tv/shared`). On modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/octaveRights/octaveRightsContract.ts apps/backend/src/octaveRights/
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

describe("miroir d'« Accès à Octave »", () => {
  it("octaveRightsContract.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/octaveRights/octaveRightsContract.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/octaveRights/octaveRightsContract.ts"), "utf8"));
  });
});
