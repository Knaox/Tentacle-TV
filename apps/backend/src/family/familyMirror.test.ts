/**
 * Le verrou des miroirs de la Famille : le contrat, le protocole, la table des
 * routes et les règles pures DOIVENT être l'octet pour octet ceux de
 * `packages/shared/src/family/` (le backend ne dépend pas de
 * `@tentacle-tv/shared` — tsc CommonJS, image Docker sans packages/). Un
 * contrat qui divergerait laisserait le serveur refuser ce que les clients
 * croient permis, ou l'inverse. La source canonique est SHARED ; on modifie
 * là-bas, on recopie ici :
 *
 *   cp packages/shared/src/family/family{Contract,Protocol,Routes,Rules}.ts apps/backend/src/family/
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

const MIRRORS = ["familyContract.ts", "familyProtocol.ts", "familyRoutes.ts", "familyRules.ts"];

describe("miroirs de la Famille", () => {
  it.each(MIRRORS)("%s est identique octet pour octet à celui de shared", (file) => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/family", file), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/family", file), "utf8"));
  });
});
