/**
 * Le verrou du miroir de l'accès du compte : le contrat et la règle DOIVENT être
 * l'octet pour octet ceux de `packages/shared/src/accountAccess/` (le backend ne
 * dépend pas de `@tentacle-tv/shared`). Une règle qui divergerait ferait annoncer
 * au serveur une réouverture que les clients ne calculent pas pareil. La source
 * canonique est SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/accountAccess/accountAccess{Contract,Rule}.ts apps/backend/src/accountAccess/
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

const MIRRORS = ["accountAccessContract.ts", "accountAccessRule.ts"];

describe("miroirs de l'accès du compte", () => {
  it.each(MIRRORS)("%s est identique octet pour octet à celui de shared", (file) => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/accountAccess", file), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/accountAccess", file), "utf8"));
  });
});
