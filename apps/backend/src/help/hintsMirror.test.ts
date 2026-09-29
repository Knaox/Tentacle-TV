/**
 * Le verrou du miroir des rappels masquables : le contrat de
 * `/api/preferences/hints` DOIT être l'octet pour octet celui de
 * `packages/shared/src/help/dismissibleHints.ts` (le backend ne dépend pas de
 * `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/). La
 * source canonique est SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/help/dismissibleHints.ts apps/backend/src/help/
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

describe("miroir des rappels masquables", () => {
  it("dismissibleHints.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/help/dismissibleHints.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/help/dismissibleHints.ts"), "utf8"));
  });
});
