/**
 * Le verrou du miroir des capacités : le contrat de `/api/config` →
 * `capabilities` DOIT être l'octet pour octet celui de
 * `packages/shared/src/serverCapabilities/serverCapabilities.ts` (le backend ne
 * dépend pas de `@tentacle-tv/shared`). Un contrat qui divergerait ferait
 * déclarer au serveur des clés que les clients ignorent, ou l'inverse. La
 * source canonique est SHARED ; on modifie là-bas, on recopie ici :
 *
 *   cp packages/shared/src/serverCapabilities/serverCapabilities.ts apps/backend/src/serverCapabilities/
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { describe, expect, it } from "vitest";
import { declaredServerCapabilities } from "./declaredCapabilities";
import { SERVER_CAPABILITY_KEYS, resolveServerCapabilities } from "./serverCapabilities";

function repoRoot(): string {
  let folder = process.cwd();
  while (!existsSync(join(folder, "pnpm-workspace.yaml"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error("racine du dépôt introuvable");
    folder = parent;
  }
  return folder;
}

describe("miroir des capacités du serveur", () => {
  it("serverCapabilities.ts est identique octet pour octet à celui de shared", () => {
    const root = repoRoot();
    expect(readFileSync(join(root, "apps/backend/src/serverCapabilities/serverCapabilities.ts"), "utf8"))
      .toBe(readFileSync(join(root, "packages/shared/src/serverCapabilities/serverCapabilities.ts"), "utf8"));
  });

  it("le serveur déclare chaque clé de son contrat, et un client à jour les lit toutes", () => {
    const declared = declaredServerCapabilities();
    expect(declared).toEqual(SERVER_CAPABILITY_KEYS);
    expect(resolveServerCapabilities({ version: "0.0.0", capabilities: declared }).size).toBe(SERVER_CAPABILITY_KEYS.length);
  });
});
