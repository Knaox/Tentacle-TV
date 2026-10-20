/**
 * Le verrou du miroir de ce que la session peut faire : le contrat DOIT être
 * l'octet pour octet celui de `packages/shared/src/accountAbilities/`.
 *
 *   cp packages/shared/src/accountAbilities/accountAbilitiesContract.ts apps/backend/src/accountAbilities/
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

describe("miroir de ce que la session peut faire", () => {
  it("accountAbilitiesContract.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/accountAbilities/accountAbilitiesContract.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/accountAbilities/accountAbilitiesContract.ts"), "utf8"));
  });
});
