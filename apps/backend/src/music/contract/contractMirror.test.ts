/**
 * Le verrou du miroir du contrat musique (Octave, docs/octave/CONTRATS.md) :
 * `apps/backend/src/music/contract/*` DOIT être `packages/shared/src/music/*`,
 * octet pour octet (le backend ne dépend pas de `@tentacle-tv/shared`). La
 * source canonique est SHARED ; on modifie là-bas, on recopie ici :
 *
 *   for f in musicTypes musicKeys musicPlayback musicCoreApi musicEvents musicLibraryMatch musicImport musicImportSkip musicListOrder musicSourceOrder musicShare musicMosaic shazamLink musicPlaylistMembers musicLibraryShelves musicSearchHistory; do
 *     cp packages/shared/src/music/$f.ts apps/backend/src/music/contract/; done
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";

const FILES = ["musicTypes", "musicKeys", "musicPlayback", "musicCoreApi", "musicEvents", "musicLibraryMatch", "musicImport", "musicImportSkip", "musicListOrder", "musicSourceOrder", "musicShare", "musicMosaic", "shazamLink", "musicPlaylistMembers", "musicLibraryShelves", "musicSearchHistory"];

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("miroir du contrat musique", () => {
  it.each(FILES)("%s.ts est identique à celui de shared", (name) => {
    const root = repoRoot();
    const canonical = readFileSync(join(root, `packages/shared/src/music/${name}.ts`), "utf8");
    const mirror = readFileSync(join(root, `apps/backend/src/music/contract/${name}.ts`), "utf8");
    expect(mirror).toBe(canonical);
  });

  it("AudioItemRef du flux « éléments audio vus » suit pluginServerRuntime.ts", () => {
    const root = repoRoot();
    const runtime = readFileSync(join(root, "packages/shared/src/plugins/pluginServerRuntime.ts"), "utf8");
    const feed = readFileSync(join(root, "apps/backend/src/music/events/audioItemsFeed.ts"), "utf8");
    const block = (source: string) => source.match(/export interface AudioItemRef \{[^}]*\}/)?.[0].replace(/\s+/g, " ");
    expect(block(feed)).toBe(block(runtime));
  });
});
