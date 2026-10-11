/**
 * Le verrou du miroir du protocole hôte ↔ serveur : ces fichiers DOIVENT être
 * l'octet pour octet ceux de `packages/shared/src/serverHost/` (l'hôte
 * Windows lit shared, le serveur ne dépend pas de shared). On modifie
 * là-bas, on recopie ici :
 *
 *   cp packages/shared/src/serverHost/host{Protocol,Methods}.ts apps/backend/src/serverHost/
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
  it.each(["hostProtocol.ts", "hostMethods.ts"])("%s est identique octet pour octet à celui de shared", (file) => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/serverHost", file), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/serverHost", file), "utf8"));
  });
});
