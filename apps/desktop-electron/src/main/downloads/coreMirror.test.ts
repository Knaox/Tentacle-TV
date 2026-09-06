/**
 * Le verrou du miroir : `downloads/core/` et `downloads/node/` DOIVENT être
 * l'octet pour octet `packages/offline-core/src/{core,node}/` (sans ses tests
 * ni ses index). Le main est compilé par tsc sans dépendre d'un paquet du
 * monorepo — même patron que `sharedMirror.test.ts` côté backend. La source
 * canonique est LE PAQUET ; on modifie là-bas, puis :
 *
 *   pnpm --filter @tentacle-tv/offline-core mirror
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

const skipped = (name: string): boolean =>
  name.endsWith(".test.ts") || name === "testkit.ts" || name === "index.ts";

const ZONES: Array<[string, string]> = [
  ["packages/offline-core/src/core", "apps/desktop-electron/src/main/downloads/core"],
  ["packages/offline-core/src/node", "apps/desktop-electron/src/main/downloads/node"],
];

describe("miroir du cœur hors ligne", () => {
  it.each(ZONES)("%s → %s : mêmes fichiers, octet pour octet", (from, to) => {
    const root = repoRoot();
    const canonical = readdirSync(join(root, from))
      .filter((name) => name.endsWith(".ts") && !skipped(name))
      .sort();
    const mirrored = readdirSync(join(root, to))
      .filter((name) => name.endsWith(".ts"))
      .sort();
    // Un fichier oublié — dans un sens ou dans l'autre — compte comme une divergence.
    expect(mirrored).toEqual(canonical);
    for (const name of canonical) {
      expect(readFileSync(join(root, to, name), "utf8"), name).toBe(
        readFileSync(join(root, from, name), "utf8"),
      );
    }
  });
});
