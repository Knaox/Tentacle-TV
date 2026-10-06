/**
 * Le contrat de la détection des passages est l'octet pour octet de celui de
 * `packages/shared/src/segmentPlugins/` (le backend ne dépend pas de shared).
 * On modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/segmentPlugins/segmentPluginsContract.ts apps/backend/src/services/segmentPlugins/
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

describe("miroir du contrat des greffons de passages", () => {
  it("segmentPluginsContract.ts est identique à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/services/segmentPlugins/segmentPluginsContract.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/segmentPlugins/segmentPluginsContract.ts"), "utf8"));
  });
});
