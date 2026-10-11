/**
 * Le verrou du miroir du protocole hôte ↔ serveur : ce fichier DOIT être
 * l'octet pour octet celui de `packages/shared/src/serverHost/hostProtocol.ts`
 * (l'hôte Windows lit shared, le serveur ne dépend pas de shared). On modifie
 * là-bas, on recopie ici :
 *
 *   cp packages/shared/src/serverHost/hostProtocol.ts apps/backend/src/serverHost/
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

describe("miroir du protocole hôte ↔ serveur", () => {
  it("hostProtocol.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/serverHost/hostProtocol.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/serverHost/hostProtocol.ts"), "utf8"));
  });
});
