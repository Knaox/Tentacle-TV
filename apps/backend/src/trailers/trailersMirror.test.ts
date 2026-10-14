/**
 * Le verrou du miroir des bandes-annonces : la liste (fusion, langue, type),
 * le contrat de l'aperçu au survol (`/api/trailers/preview`), celui de sa
 * préparation (`/api/trailers/preview/warm`) et celui du catalogue
 * (`/api/trailers/catalog`, avec ses règles) DOIVENT être
 * l'octet pour octet ceux de `packages/shared/src/trailers/` (le backend ne
 * dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans
 * packages/). Le serveur choisit ainsi l'aperçu avec les règles mêmes de la
 * fiche, et lit la demande comme le client l'écrit. La source canonique est
 * SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/trailers/{trailerList,trailerPreview,trailerPreviewWarm,trailerCatalog,trailerCatalogRank}.ts apps/backend/src/trailers/
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

describe("miroir des bandes-annonces", () => {
  it.each(["trailerList.ts", "trailerPreview.ts", "trailerPreviewWarm.ts", "trailerCatalog.ts", "trailerCatalogRank.ts"])("%s est identique octet pour octet à celui de shared", (name) => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/trailers", name), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/trailers", name), "utf8"));
  });
});
