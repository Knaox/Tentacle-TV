/**
 * Le verrou du miroir de la saga : le contrat de `/api/sagas` DOIT être
 * l'octet pour octet celui de `packages/shared/src/saga/sagaTypes.ts` (le
 * backend ne dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker
 * sans packages/). La source canonique est SHARED ; on modifie là-bas, on
 * recopie ici :
 *
 *   cp packages/shared/src/saga/sagaTypes.ts apps/backend/src/saga/
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

describe("miroir de la saga", () => {
  it("sagaTypes.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/saga/sagaTypes.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/saga/sagaTypes.ts"), "utf8"));
  });
});
