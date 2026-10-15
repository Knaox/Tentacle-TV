/**
 * Le verrou du miroir des droits : le contrat, les routes et la validation du
 * correctif DOIVENT être l'octet pour octet ceux de `packages/shared/src/userRights/`
 * (le backend ne dépend pas de `@tentacle-tv/shared`). Un contrat qui divergerait
 * laisserait le serveur refuser ce que l'administration croit permis, ou l'inverse.
 * La source canonique est SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/userRights/userRights{Contract,Routes,Patch}.ts apps/backend/src/userRights/
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

const MIRRORS = ["userRightsContract.ts", "userRightsRoutes.ts", "userRightsPatch.ts"];

describe("miroirs des droits", () => {
  it.each(MIRRORS)("%s est identique octet pour octet à celui de shared", (file) => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/userRights", file), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/userRights", file), "utf8"));
  });
});
