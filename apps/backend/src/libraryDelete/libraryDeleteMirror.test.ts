/**
 * Le verrou du miroir de la suppression de titres : le contrat (routes, limites,
 * validation du corps) DOIT être l'octet pour octet celui de
 * `packages/shared/src/libraryDelete/` (le backend ne dépend pas de
 * `@tentacle-tv/shared`). Un contrat qui divergerait laisserait le serveur refuser
 * un lot que le client croit valide, ou l'inverse. La source canonique est SHARED :
 *
 *   cp packages/shared/src/libraryDelete/libraryDeleteContract.ts apps/backend/src/libraryDelete/
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

describe("miroir de la suppression de titres", () => {
  it("libraryDeleteContract.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/libraryDelete/libraryDeleteContract.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/libraryDelete/libraryDeleteContract.ts"), "utf8"));
  });
});
