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
import { SERVER_CAPABILITIES, SERVER_CAPABILITY_KEYS, resolveServerCapabilities } from "./serverCapabilities";
import { compareServerVersions } from "../services/serverUpdate/serverUpdateContract";

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

  it("un serveur de la version la plus récente du contrat déclare chaque clé, et un client à jour les lit toutes", () => {
    const newest = SERVER_CAPABILITY_KEYS.map((key) => SERVER_CAPABILITIES[key]).sort((a, b) => compareServerVersions(b, a))[0];
    const declared = declaredServerCapabilities(newest);
    expect(declared).toEqual(SERVER_CAPABILITY_KEYS);
    expect(resolveServerCapabilities({ version: "0.0.0", capabilities: declared }).size).toBe(SERVER_CAPABILITY_KEYS.length);
  });
});

describe("le serveur ne déclare que ce que SA version atteint", () => {
  const since140 = SERVER_CAPABILITY_KEYS.filter((key) => SERVER_CAPABILITIES[key] === "1.40.0");
  const upTo1314 = SERVER_CAPABILITY_KEYS.filter((key) => compareServerVersions(SERVER_CAPABILITIES[key], "1.31.4") <= 0);

  it("1.31.4 : aucune clé de 1.40.0, et toutes celles d'avant, comme avant", () => {
    expect(since140.length).toBeGreaterThan(0);
    const declared = declaredServerCapabilities("1.31.4");
    expect(declared).toEqual(upTo1314);
    for (const key of since140) expect(declared).not.toContain(key);
  });

  it("1.40.0 et 1.40.0+preview.<sha> (version fixée au build) : les clés de 1.40.0 aussi", () => {
    for (const version of ["1.40.0", "1.40.0+preview.fab15c3"]) {
      const declared = declaredServerCapabilities(version);
      for (const key of [...upTo1314, ...since140]) expect(declared, `${version} ${key}`).toContain(key);
    }
  });

  it("la porte d'une route répond 404 not_available quand sa clé n'est pas déclarée", async () => {
    const { capabilityGate, isCapabilityDeclared } = await import("./declaredCapabilities");
    const sent: { code?: number; body?: unknown } = {};
    const reply = { status: (code: number) => ({ send: (body: unknown) => Object.assign(sent, { code, body }) }) };
    const declared = isCapabilityDeclared("music.library");
    await capabilityGate("music.library")({} as never, reply as never);
    expect(sent.code === undefined).toBe(declared);
    if (!declared) expect(sent).toEqual({ code: 404, body: { error: "not_available" } });
  });
});
