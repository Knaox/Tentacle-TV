/**
 * Le verrou du contrat Watch Together : `protocolMessages.ts` DOIT être
 * `packages/shared/src/types/watchTogetherMessages.ts`, aux chemins d'import
 * près (le backend ne dépend pas de `@tentacle-tv/shared` — tsc CommonJS,
 * image Docker sans packages/). La source canonique est SHARED ; on modifie
 * là-bas, on recopie ici en adaptant la profondeur des imports :
 *
 *   sed 's#from "../playback/#from "../../playback/#' \
 *     packages/shared/src/types/watchTogetherMessages.ts \
 *     > apps/backend/src/services/watchTogether/protocolMessages.ts
 *
 * Même esprit que `playback/sharedMirror.test.ts`, avec une tolérance : les
 * spécificateurs d'import sont normalisés avant comparaison, rien d'autre.
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

/** Les imports relatifs du dossier `playback/` ramenés à une forme commune. */
function normalizeImports(source: string): string {
  return source.replace(/from "(\.\.\/)+playback\//g, 'from "<playback>/');
}

describe("miroir du contrat Watch Together", () => {
  it("protocolMessages.ts est watchTogetherMessages.ts, aux imports près", () => {
    const root = repoRoot();
    const canonical = readFileSync(join(root, "packages/shared/src/types/watchTogetherMessages.ts"), "utf8");
    const mirror = readFileSync(join(root, "apps/backend/src/services/watchTogether/protocolMessages.ts"), "utf8");
    expect(normalizeImports(mirror)).toBe(normalizeImports(canonical));
  });
});
