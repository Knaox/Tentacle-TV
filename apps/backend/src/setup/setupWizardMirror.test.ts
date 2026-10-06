/**
 * Le MIROIR du contrat de l'assistant d'installation : `setupWizardContract.ts`
 * est l'octet pour octet de celui de `packages/shared/src/setupWizard/` (le
 * backend ne dépend pas de `@tentacle-tv/shared`). La source canonique est
 * SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/setupWizard/setup*Contract.ts apps/backend/src/setup/
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

describe("miroir du contrat de l'assistant d'installation", () => {
  it.each(["setupWizardContract.ts", "setupDiscoveryContract.ts", "setupFlowContract.ts"])("%s est identique octet pour octet à celui de shared", (file) => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/setup", file), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/setupWizard", file), "utf8"));
  });
});
