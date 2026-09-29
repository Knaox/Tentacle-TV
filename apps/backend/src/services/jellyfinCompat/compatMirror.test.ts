/**
 * Les deux verrous du manifeste de compatibilité Jellyfin :
 *
 * 1. le MIROIR : `compatManifest.ts`, `compatVerdict.ts` et `compatReport.ts`
 *    sont l'octet pour octet de ceux de `packages/shared/src/jellyfinCompat/`
 *    (le backend ne dépend pas de `@tentacle-tv/shared`). La source canonique
 *    est SHARED ; on modifie là-bas, on recopie ici :
 *
 *      cp packages/shared/src/jellyfinCompat/compat{Manifest,Verdict,Report}.ts apps/backend/src/services/jellyfinCompat/
 *
 * 2. le FICHIER COMMITÉ, `compat/jellyfin.json` : il se lit sans une faute, et
 *    chaque verdict global est celui que la règle tire de ses fonctionnalités.
 *    Un manifeste que le serveur refuserait partirait sinon dans l'image, et
 *    tous les verdicts tomberaient à « non testée » sans un mot.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import { parseCompatManifest } from "./compatManifest";
import { deriveTestedVerdict } from "./compatVerdict";

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("miroir du manifeste de compatibilité", () => {
  for (const file of ["compatManifest.ts", "compatVerdict.ts", "compatReport.ts"]) {
    it(`${file} est identique octet pour octet à celui de shared`, () => {
      const root = repoRoot();
      expect(readFileSync(join(root, "apps/backend/src/services/jellyfinCompat", file), "utf8"))
        .toBe(readFileSync(join(root, "packages/shared/src/jellyfinCompat", file), "utf8"));
    });
  }
});

describe("compat/jellyfin.json, tel qu'il part dans l'image", () => {
  const raw: unknown = JSON.parse(readFileSync(join(repoRoot(), "compat/jellyfin.json"), "utf8"));
  const parsed = parseCompatManifest(raw);

  it("se lit sans une faute", () => {
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
  });

  it("chaque verdict global est celui que la règle tire des fonctionnalités", () => {
    if (!parsed.ok) return;
    for (const entry of parsed.manifest.versions) {
      expect({ version: entry.version, verdict: entry.verdict })
        .toEqual({ version: entry.version, verdict: deriveTestedVerdict(entry.features, parsed.manifest.features) });
    }
  });

  it("chaque zone citée par une fonctionnalité a son libellé, dès qu'il y a des zones", () => {
    if (!parsed.ok || Object.keys(parsed.manifest.areas).length === 0) return;
    const missing = parsed.manifest.features.filter((feature) => !parsed.manifest.areas[feature.area]).map((f) => f.id);
    expect(missing).toEqual([]);
  });
});
