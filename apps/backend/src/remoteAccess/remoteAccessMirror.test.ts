/**
 * Les MIROIRS de l'accès à distance : `checkProtocol.ts` et
 * `remoteAccessContract.ts` sont l'octet pour octet de ceux de
 * `packages/shared/src/remoteAccess/` (le backend ne dépend pas de
 * `@tentacle-tv/shared`). La source canonique est SHARED ; on modifie là-bas,
 * on recopie ici :
 *
 *   cp packages/shared/src/remoteAccess/{checkProtocol,remoteAccessContract}.ts apps/backend/src/remoteAccess/
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

describe("miroirs de l'accès à distance", () => {
  for (const file of ["checkProtocol.ts", "remoteAccessContract.ts"]) {
    it(`${file} est identique octet pour octet à celui de shared`, () => {
      const root = repoRoot();
      expect(readFileSync(join(root, "apps/backend/src/remoteAccess", file), "utf8"))
        .toBe(readFileSync(join(root, "packages/shared/src/remoteAccess", file), "utf8"));
    });
  }
});
