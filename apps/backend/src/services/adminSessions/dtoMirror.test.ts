/**
 * Le verrou du contrat du tableau de bord des sessions : `dto.ts` DOIT être
 * `packages/shared/src/types/adminSessionsDto.ts`, octet pour octet (le
 * backend ne dépend pas de `@tentacle-tv/shared`). On modifie là-bas, on
 * recopie ici :
 *
 *   cp packages/shared/src/types/adminSessionsDto.ts \
 *      apps/backend/src/services/adminSessions/dto.ts
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

describe("miroir du contrat du tableau de bord des sessions", () => {
  it("dto.ts est adminSessionsDto.ts", () => {
    const root = repoRoot();
    const canonical = readFileSync(join(root, "packages/shared/src/types/adminSessionsDto.ts"), "utf8");
    const mirror = readFileSync(join(root, "apps/backend/src/services/adminSessions/dto.ts"), "utf8");
    expect(mirror).toBe(canonical);
  });
});
