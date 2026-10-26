/**
 * La configuration d'office d'une extension (`configDefaults` du manifeste) : posée là où elle MANQUE,
 * jamais par-dessus un réglage — un `enabled: false` posé exprès reste coupé —, et rien pour une
 * extension qui ne déclare rien (Vigie et son formulaire).
 */

import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./dataDir", async () => {
  const { tmpdir } = await import("os");
  const path = await import("path");
  return { DATA_ROOT: path.join(tmpdir(), `tentacle-config-defaults-${process.pid}`) };
});

import { DATA_DIR, getInstalled, saveInstalled } from "./pluginManager";
import { readConfigDefaults, repairInstalledConfigDefaults, withConfigDefaults } from "./pluginConfigDefaults";

function seed(pluginId: string, config: Record<string, unknown>, manifest: unknown): void {
  saveInstalled([...getInstalled(), {
    id: `id-${pluginId}`, pluginId, sourceId: "official", name: pluginId, version: "1.0.0", enabled: true, config,
    installedAt: "2026-10-01T00:00:00.000Z",
  }]);
  mkdirSync(join(DATA_DIR, pluginId), { recursive: true });
  writeFileSync(join(DATA_DIR, pluginId, "plugin.json"), JSON.stringify(manifest));
}

const configOf = (pluginId: string) => getInstalled().find((p) => p.pluginId === pluginId)?.config;

beforeEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(DATA_DIR, { recursive: true, force: true });
});

describe("configDefaults : lecture du manifeste", () => {
  it("ne garde que des valeurs simples, sous des clés sages", () => {
    expect(readConfigDefaults({ configDefaults: { enabled: true, quota: 3, name: "x", none: null } }))
      .toEqual({ enabled: true, quota: 3, name: "x", none: null });
    expect(readConfigDefaults({ configDefaults: { nested: { a: 1 }, list: [1], "../x": true, __proto__x: 1, ok: false } }))
      .toEqual({ ok: false });
    expect(readConfigDefaults({ configDefaults: { long: "x".repeat(300) } })).toBeNull();
  });

  it("rien déclaré, ou mal formé : rien", () => {
    for (const manifest of [null, {}, { configDefaults: null }, { configDefaults: [true] }, { configDefaults: "enabled" }, { configDefaults: {} }]) {
      expect(readConfigDefaults(manifest)).toBeNull();
    }
  });
});

describe("configDefaults : seules les clés qui manquent", () => {
  it("pose ce qui manque, garde le reste", () => {
    expect(withConfigDefaults({}, { enabled: true })).toEqual({ enabled: true });
    expect(withConfigDefaults(undefined, { enabled: true })).toEqual({ enabled: true });
    expect(withConfigDefaults({ url: "u" }, { enabled: true })).toEqual({ url: "u", enabled: true });
  });

  it("jamais par-dessus un réglage : enabled:false posé exprès reste coupé", () => {
    expect(withConfigDefaults({ enabled: false }, { enabled: true })).toBeNull();
    expect(withConfigDefaults({ enabled: true }, { enabled: true })).toBeNull();
    expect(withConfigDefaults({}, null)).toBeNull();
  });
});

describe("configDefaults : réparation au démarrage", () => {
  it("une extension installée depuis une source avec config {} est activée", () => {
    seed("sillon", {}, { configDefaults: { enabled: true } });
    expect(repairInstalledConfigDefaults()).toEqual(["sillon"]);
    expect(configOf("sillon")).toEqual({ enabled: true });
    // Une fois posée, la clé n'est plus « manquante » : rien de plus au démarrage suivant.
    expect(repairInstalledConfigDefaults()).toEqual([]);
  });

  it("enabled:false explicite respecté ; Vigie (rien déclaré, sa config à elle) inchangé", () => {
    seed("musique", { enabled: false }, { configDefaults: { enabled: true } });
    seed("vigie", { enabled: true, url: "http://seerr", apiKey: "k" }, { name: "Vigie" });
    seed("vigie-off", {}, { name: "Vigie coupé" });
    expect(repairInstalledConfigDefaults()).toEqual([]);
    expect(configOf("musique")).toEqual({ enabled: false });
    expect(configOf("vigie")).toEqual({ enabled: true, url: "http://seerr", apiKey: "k" });
    expect(configOf("vigie-off")).toEqual({});
  });
});
