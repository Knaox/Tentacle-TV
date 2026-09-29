/**
 * Le verrou des contrats des statistiques : ils DOIVENT être ceux de
 * `packages/shared/src/` (le backend ne dépend pas de `@tentacle-tv/shared` —
 * tsc CommonJS, image Docker sans packages/). La source canonique est SHARED ;
 * on modifie là-bas, puis :
 *
 *   cp packages/shared/src/types/viewingStats.ts \
 *     apps/backend/src/services/viewingStats/contract.ts
 *   cp packages/shared/src/viewingStats/habits.ts \
 *     apps/backend/src/services/viewingStats/habits.ts
 *   sed -e 's#from "../viewingStats/habits"#from "./habits"#' \
 *       -e 's#from "./viewingStats"#from "./contract"#' \
 *     packages/shared/src/types/viewingStatsShare.ts \
 *     > apps/backend/src/services/viewingStats/contractShare.ts
 *
 * Les deux premiers n'importent rien : octet pour octet. Le contrat du
 * partage importe les deux autres ; ses chemins d'import sont normalisés
 * avant comparaison, rien d'autre (même esprit que
 * `watchTogether/protocolMirror.test.ts`).
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

const read = (path: string): string => readFileSync(join(repoRoot(), path), "utf8");

/** Les imports des deux contrats ramenés à une forme commune. */
function normalizeImports(source: string): string {
  return source
    .replace(/from "(\.\.\/viewingStats\/|\.\/)habits"/g, 'from "<habits>"')
    .replace(/from "\.\/(viewingStats|contract)"/g, 'from "<contract>"');
}

describe("miroir des contrats des statistiques de visionnage", () => {
  it("contract.ts est viewingStats.ts de shared, à l'octet près", () => {
    expect(read("apps/backend/src/services/viewingStats/contract.ts")).toBe(read("packages/shared/src/types/viewingStats.ts"));
  });

  it("habits.ts est celui de shared, à l'octet près", () => {
    expect(read("apps/backend/src/services/viewingStats/habits.ts")).toBe(read("packages/shared/src/viewingStats/habits.ts"));
  });

  it("contractShare.ts est viewingStatsShare.ts de shared, aux imports près", () => {
    const mirror = read("apps/backend/src/services/viewingStats/contractShare.ts");
    const canonical = read("packages/shared/src/types/viewingStatsShare.ts");
    expect(normalizeImports(mirror)).toBe(normalizeImports(canonical));
    // La normalisation ne doit pas tout effacer : les imports existent bien.
    expect(normalizeImports(mirror)).toContain('from "<habits>"');
    expect(normalizeImports(mirror)).toContain('from "<contract>"');
  });
});
