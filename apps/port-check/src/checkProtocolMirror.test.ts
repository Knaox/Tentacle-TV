/**
 * Le MIROIR du protocole : `checkProtocol.ts` est l'octet pour octet de celui
 * de `packages/shared/src/remoteAccess/`. On modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/remoteAccess/checkProtocol.ts apps/port-check/src/
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

describe("miroir du protocole du test d'ouverture", () => {
  it("checkProtocol.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/port-check/src/checkProtocol.ts"), "utf8")).toBe(
      readFileSync(join(root, "packages/shared/src/remoteAccess/checkProtocol.ts"), "utf8"),
    );
  });
});
