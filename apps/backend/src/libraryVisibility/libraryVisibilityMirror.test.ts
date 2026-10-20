/**
 * Le verrou du miroir du verdict des titres gardés : le contrat DOIT être
 * l'octet pour octet celui de `packages/shared/src/library/` (le backend ne
 * dépend pas de `@tentacle-tv/shared`). Source canonique : SHARED.
 *
 *   cp packages/shared/src/library/libraryVisibilityContract.ts apps/backend/src/libraryVisibility/
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

describe("miroir du verdict des titres gardés", () => {
  it("libraryVisibilityContract.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/libraryVisibility/libraryVisibilityContract.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/library/libraryVisibilityContract.ts"), "utf8"));
  });
});
