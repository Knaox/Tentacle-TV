import { beforeEach, describe, expect, it, vi } from "vitest";
import { declaresSqliteSupport, missingServerVersion, refusedPlugins, requiredServerVersionOf, storageRefusal } from "./gate";

/*
 * La garde, FERMÉE : une extension à module serveur qui ne déclare pas
 * `storage.sqlite` ne se charge pas, sans détection de moteur ; un
 * identifiant invalide vaut refus.
 */

const { manifests, serverModules } = vi.hoisted(() => ({
  manifests: new Map<string, Record<string, unknown> | null>(),
  serverModules: new Set<string>(),
}));

const serverVersion = vi.hoisted(() => ({ value: "1.31.4" }));
vi.mock("../version", () => ({
  get BACKEND_VERSION() {
    return serverVersion.value;
  },
}));
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


beforeEach(() => {
  serverVersion.value = "1.31.4";
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

describe("version de Tentacle exigée", () => {
  const isolated = { runtime: { kind: "isolated", entry: "server/index.mjs" }, storage: { sqlite: true } };

  it("le manifeste : minTentacleVersion, et le runtime isolé (1.40.0) qu'il demande — la plus haute", () => {
    expect(requiredServerVersionOf(null)).toBeNull();
    expect(requiredServerVersionOf({ entry: "x.js" })).toBeNull();
    expect(requiredServerVersionOf({ minTentacleVersion: "1.25.0" })).toBe("1.25.0");
    expect(requiredServerVersionOf({ minTentacleVersion: "plus tard" })).toBeNull();
    expect(requiredServerVersionOf(isolated)).toBe("1.40.0");
    expect(requiredServerVersionOf({ ...isolated, minTentacleVersion: "1.32.0" })).toBe("1.40.0");
    expect(requiredServerVersionOf({ ...isolated, minTentacleVersion: "1.41.2" })).toBe("1.41.2");
  });

  it("serveur trop ancien : refusée (avant toute autre raison) et listée ; atteinte : chargée", () => {
    manifests.set("ready", { server: "server/index.mjs", storage: { sqlite: true }, minTentacleVersion: "1.40.0" });
    expect(missingServerVersion("ready")).toBe("1.40.0");
    expect(storageRefusal("ready")).toBe("requiresNewerServer");
    expect(refusedPlugins().map((plugin) => plugin.reason)).toEqual(["sqliteUnsupported", "requiresNewerServer"]);
    serverVersion.value = "1.40.0+preview.fab15c3";
    expect(missingServerVersion("ready")).toBeNull();
    expect(storageRefusal("ready")).toBeNull();
  });

  it("une extension isolée sans exigence : refusée sous 1.40.0, chargée à partir de 1.40.0", () => {
    manifests.set("pages", isolated);
    expect(storageRefusal("pages")).toBe("requiresNewerServer");
    serverVersion.value = "1.40.0";
    expect(storageRefusal("pages")).toBeNull();
  });
});
