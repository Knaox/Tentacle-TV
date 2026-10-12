/**
 * Le verrou du miroir de « Réanalyser maintenant » : le contrat de
 * `POST /api/admin/library/rescan` DOIT être l'octet pour octet celui de
 * `packages/shared/src/library/libraryRescanContract.ts` (le backend ne dépend
 * pas de `@tentacle-tv/shared`). La source canonique est SHARED :
 *
 *   cp packages/shared/src/library/libraryRescanContract.ts apps/backend/src/library/
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

describe("miroir du contrat « Réanalyser maintenant »", () => {
  it("libraryRescanContract.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/library/libraryRescanContract.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/library/libraryRescanContract.ts"), "utf8"));
  });
});
