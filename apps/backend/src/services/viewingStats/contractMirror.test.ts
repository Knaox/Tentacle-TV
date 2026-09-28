/**
 * Le verrou du contrat des statistiques : `contract.ts` DOIT être
 * `packages/shared/src/types/viewingStats.ts`, octet pour octet (le backend
 * ne dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans
 * packages/). La source canonique est SHARED ; on modifie là-bas, puis :
 *
 *   cp packages/shared/src/types/viewingStats.ts \
 *     apps/backend/src/services/viewingStats/contract.ts
 *
 * Même esprit que `watchTogether/protocolMirror.test.ts`, sans tolérance :
 * le contrat n'importe rien, il n'y a pas de chemin à normaliser.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";

/** La racine du dépôt, trouvée depuis le cwd (pnpm place le cwd dans le paquet). */
function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("miroir du contrat des statistiques de visionnage", () => {
  it("contract.ts est viewingStats.ts de shared, à l'octet près", () => {
    const root = repoRoot();
    const canonical = readFileSync(join(root, "packages/shared/src/types/viewingStats.ts"), "utf8");
    const mirror = readFileSync(join(root, "apps/backend/src/services/viewingStats/contract.ts"), "utf8");
    expect(mirror).toBe(canonical);
  });
});
