/**
 * Le verrou du miroir du runtime isolé : `pluginServerRuntime.ts` DOIT être
 * l'octet pour octet celui de `packages/shared/src/plugins/` (le backend ne
 * dépend pas de `@tentacle-tv/shared`). Les noms traversent la frontière d'un
 * processus : un écart ferait parler l'hôte et l'invité deux langues. La source
 * canonique est SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/plugins/pluginServerRuntime.ts packages/shared/src/plugins/pluginClientFetch.ts apps/backend/src/plugins/runtime/
 *   cp packages/shared/src/plugins/pluginNavigation.ts apps/backend/src/plugins/runtime/navigation/
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

describe("miroir du runtime isolé", () => {
  it("pluginServerRuntime.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    const shared = readFileSync(join(root, "packages/shared/src/plugins/pluginServerRuntime.ts"), "utf8");
    const mirror = readFileSync(join(root, "apps/backend/src/plugins/runtime/pluginServerRuntime.ts"), "utf8");
    expect(mirror).toBe(shared);
  });

  it("pluginNavigation.ts (navigation réglée par l'extension) est identique à celui de shared", () => {
    const root = repoRoot();
    const shared = readFileSync(join(root, "packages/shared/src/plugins/pluginNavigation.ts"), "utf8");
    const mirror = readFileSync(join(root, "apps/backend/src/plugins/runtime/navigation/pluginNavigation.ts"), "utf8");
    expect(mirror).toBe(shared);
  });

  it("pluginClientFetch.ts (requêtes déléguées) est identique à celui de shared", () => {
    const root = repoRoot();
    const shared = readFileSync(join(root, "packages/shared/src/plugins/pluginClientFetch.ts"), "utf8");
    for (const copy of ["apps/backend/src/plugins/runtime/pluginClientFetch.ts", "apps/desktop-electron/src/main/clientFetch/pluginClientFetch.ts"]) {
      expect(readFileSync(join(root, copy), "utf8"), copy).toBe(shared);
    }
  });

  it("la lecture du contrat `music` est celle de shared (readPluginMusicManifest)", () => {
    const root = repoRoot();
    const section = (text: string) => text.slice(text.indexOf("\nconst SAFE_PATH"));
    const shared = readFileSync(join(root, "packages/shared/src/music/pluginMusicContract.ts"), "utf8");
    const mirror = readFileSync(join(root, "apps/backend/src/routes/pluginMusicMeta.ts"), "utf8");
    expect(section(mirror)).toBe(section(shared));
  });
});
