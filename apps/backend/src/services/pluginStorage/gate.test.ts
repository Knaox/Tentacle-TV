import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * La garde, FERMÉE : une extension à module serveur qui ne déclare pas
 * `storage.sqlite` ne se charge pas, sans détection de moteur ; un
 * identifiant invalide vaut refus.
 */

const manifests = new Map<string, Record<string, unknown> | null>();
const serverModules = new Set<string>();

vi.mock("../pluginServerModule", () => ({
  readPluginManifest: (id: string) => manifests.get(id) ?? null,
  pluginHasServerModule: (id: string) => serverModules.has(id),
}));
vi.mock("../pluginManager", () => ({
  isValidPluginId: (id: string) => /^[a-z0-9-]+$/.test(id),
  getInstalled: () => [
    { pluginId: "seer", name: "Vigie", version: "1.24.1", enabled: true },
    { pluginId: "ready", name: "Prête", version: "2.0.0", enabled: true },
    { pluginId: "pages", name: "Pages seules", version: "1.0.0", enabled: true },
    { pluginId: "off", name: "Éteinte", version: "1.0.0", enabled: false },
  ],
}));

const { declaresSqliteSupport, refusedPlugins, storageRefusal } = await import("./gate");

beforeEach(() => {
  manifests.clear();
  serverModules.clear();
  manifests.set("seer", { server: "server/index.mjs" });
  manifests.set("ready", { server: "server/index.mjs", storage: { sqlite: true } });
  manifests.set("pages", { entry: "dist/x.js" });
  manifests.set("off", { server: "server/index.mjs" });
  for (const id of ["seer", "ready", "off"]) serverModules.add(id);
});

describe("déclaration au manifeste", () => {
  it("seul `storage.sqlite: true` vaut déclaration", () => {
    expect(declaresSqliteSupport({ storage: { sqlite: true } })).toBe(true);
    expect(declaresSqliteSupport({ storage: { sqlite: "yes" } })).toBe(false);
    expect(declaresSqliteSupport({ storage: true })).toBe(false);
    expect(declaresSqliteSupport(null)).toBe(false);
  });
});

describe("refus", () => {
  it("refuse un module serveur non déclaré, laisse passer le déclaré et les pages seules", () => {
    expect(storageRefusal("seer")).toBe("sqliteUnsupported");
    expect(storageRefusal("ready")).toBeNull();
    expect(storageRefusal("pages")).toBeNull();
  });

  it("un identifiant invalide vaut refus, jamais un passage", () => {
    expect(storageRefusal("../seer")).toBe("sqliteUnsupported");
    expect(storageRefusal("")).toBe("sqliteUnsupported");
  });

  it("liste les extensions ACTIVÉES refusées, et elles seules", () => {
    expect(refusedPlugins()).toEqual([
      { pluginId: "seer", name: "Vigie", version: "1.24.1", reason: "sqliteUnsupported" },
    ]);
  });
});
