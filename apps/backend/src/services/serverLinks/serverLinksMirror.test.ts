/**
 * Le MIROIR du contrat des liens du serveur : `serverLinksContract.ts` est
 * l'octet pour octet de celui de `packages/shared/src/serverLinks/` (le
 * backend ne dépend pas de `@tentacle-tv/shared`). La source canonique est
 * SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/serverLinks/serverLinksContract.ts apps/backend/src/services/serverLinks/
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

describe("miroir du contrat des liens du serveur", () => {
  it("serverLinksContract.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/services/serverLinks/serverLinksContract.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/serverLinks/serverLinksContract.ts"), "utf8"));
  });
});
