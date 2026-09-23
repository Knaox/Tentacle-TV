/**
 * Le verrou des miroirs de la recherche : le texte plié et le contrat de
 * `/api/search` DOIVENT être l'octet pour octet ceux de `packages/shared/src/`
 * (le backend ne dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image
 * Docker sans packages/). Un pliage qui divergerait ferait surligner aux
 * clients autre chose que ce que le serveur a trouvé. La source canonique est
 * SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/search/{searchText,searchTypes}.ts apps/backend/src/search/
 *   cp packages/shared/src/utils/textSearch.ts apps/backend/src/utils/
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

const MIRRORS: Array<[string, string]> = [
  ["packages/shared/src/search/searchText.ts", "apps/backend/src/search/searchText.ts"],
  ["packages/shared/src/search/searchTypes.ts", "apps/backend/src/search/searchTypes.ts"],
  ["packages/shared/src/utils/textSearch.ts", "apps/backend/src/utils/textSearch.ts"],
];

describe("miroirs de la recherche", () => {
  it.each(MIRRORS)("%s est identique octet pour octet à %s", (canonicalPath, mirrorPath) => {
    const root = repoRoot();
    expect(readFileSync(join(root, mirrorPath), "utf8")).toBe(readFileSync(join(root, canonicalPath), "utf8"));
  });
});
