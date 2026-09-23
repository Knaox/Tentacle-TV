/**
 * Le verrou du contrat du canal de session : `protocolMessages.ts` DOIT être
 * `packages/shared/src/types/sessionChannelMessages.ts`, octet pour octet (le
 * backend ne dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker
 * sans packages/). La source canonique est SHARED ; on modifie là-bas, on
 * recopie ici :
 *
 *   cp packages/shared/src/types/sessionChannelMessages.ts \
 *      apps/backend/src/services/deviceSessions/protocolMessages.ts
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

describe("miroir du contrat du canal de session", () => {
  it("protocolMessages.ts est sessionChannelMessages.ts", () => {
    const root = repoRoot();
    const canonical = readFileSync(join(root, "packages/shared/src/types/sessionChannelMessages.ts"), "utf8");
    const mirror = readFileSync(join(root, "apps/backend/src/services/deviceSessions/protocolMessages.ts"), "utf8");
    expect(mirror).toBe(canonical);
  });
});
