/**
 * Une version qui exige un serveur plus récent ne s'installe pas et ne se met
 * pas à jour (409, `plugin_requires_newer_server`) ; le catalogue propose la
 * plus récente compatible. Le serveur de ce banc est en 1.25.0.
 */

import Fastify from "fastify";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/dataDir", async () => {
  const { tmpdir } = await import("os");
  const path = await import("path");
  return { DATA_ROOT: path.join(tmpdir(), `tentacle-plugin-versions-${process.pid}`) };
});

const restart = vi.hoisted(() => ({ pending: false, reasons: [] as string[] }));
vi.mock("../services/version", () => ({ BACKEND_VERSION: "1.25.0" }));

vi.mock("../services/pluginRestart", () => ({
  BOOT_ID: "boot-test",
  isRestartPending: () => restart.pending,
  beginPluginOperation: () => () => {},
  requestServerRestart: (reason: string) => {
    restart.reasons.push(reason);
  },
}));

// L'archive « extraite » : un manifeste, avec ou sans module serveur.
const archive = vi.hoisted(() => ({ withServer: true, downloads: [] as string[] }));
vi.mock("../services/pluginInstall", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const { DATA_DIR } = await import("../services/pluginManager");
  return {
    downloadPlugin: async (pluginId: string) => {
      archive.downloads.push(pluginId);
      return `${pluginId}.tgz`;
    },
    extractPlugin: async (_file: string, pluginId: string) => {
      const dir = path.join(DATA_DIR, pluginId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify(archive.withServer ? { server: "server/index.mjs" } : {}));
      return dir;
    },
    removePluginFiles: (pluginId: string) => {
      fs.rmSync(path.join(DATA_DIR, pluginId), { recursive: true, force: true });
    },
  };
});

import { DATA_DIR, clearCache, getInstalled, saveInstalled, type InstalledPlugin } from "../services/pluginManager";
import { registerPluginInstalledRoutes } from "./pluginInstalled";

const version = (v: string, min: string) => ({
  version: v, minTentacleVersion: min, downloadUrl: `https://registry.test/vigie-${v}.tgz`, checksum: `sha256:${v}`,
});
const registry = { plugins: [{ id: "vigie", name: "Vigie", latestVersion: "1.24.2", versions: [version("1.24.2", "0.9.0")] }] };

function seed(pluginId: string, v: string): InstalledPlugin {
  const plugin: InstalledPlugin = {
    id: randomUUID(), pluginId, sourceId: "official", name: pluginId, version: v, enabled: true, config: {},
    installedAt: "2026-09-01T00:00:00.000Z",
  };
  saveInstalled([...getInstalled(), plugin]);
  mkdirSync(join(DATA_DIR, pluginId), { recursive: true });
  writeFileSync(join(DATA_DIR, pluginId, "plugin.json"), JSON.stringify({ server: "server/index.mjs", storage: { sqlite: true } }));
  return plugin;
}

async function call(method: "POST", url: string, body?: unknown) {
  const app = Fastify();
  registerPluginInstalledRoutes(app);
  const response = await app.inject({ method, url, ...(body === undefined ? {} : { payload: body as object }) });
  await app.close();
  return response;
}

beforeEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });
  clearCache();
  archive.downloads = [];
  registry.plugins[0].latestVersion = "1.24.2";
  registry.plugins[0].versions = [version("1.24.2", "0.9.0")];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(registry)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  rmSync(DATA_DIR, { recursive: true, force: true });
});

describe("une version trop récente pour ce serveur", () => {
  it("l'installation la refuse, avec un code et la version exigée", async () => {
    registry.plugins[0].versions.push(version("1.26.0", "1.26.0"));
    const response = await call("POST", "/install", { pluginId: "vigie", version: "1.26.0", sourceId: "official" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "plugin_requires_newer_server", required: "1.26.0" });
    expect(archive.downloads).toEqual([]);
    expect(getInstalled()).toEqual([]);
  });

  it("l'installation prend la plus récente compatible, même si `latestVersion` est plus ancienne", async () => {
    registry.plugins[0].versions.push(version("1.25.0", "1.25.0"), version("1.26.0", "1.26.0"));
    const response = await call("POST", "/install", { pluginId: "vigie", version: "1.25.0", sourceId: "official" });
    expect(response.statusCode).toBe(200);
    expect(getInstalled()[0].version).toBe("1.25.0");
  });

  it("la mise à jour prend la plus récente compatible, jamais au-delà", async () => {
    registry.plugins[0].versions.push(version("1.25.0", "1.25.0"), version("1.26.0", "1.26.0"));
    const vigie = seed("vigie", "1.24.1");
    const response = await call("POST", `/${vigie.id}/update`);
    expect(response.json()).toMatchObject({ version: "1.25.0" });
    expect(getInstalled()[0].version).toBe("1.25.0");
  });

  it("rien de compatible de plus récent : la mise à jour est refusée, rien n'est posé", async () => {
    registry.plugins[0].latestVersion = "2.0.0";
    registry.plugins[0].versions = [version("2.0.0", "9.0.0")];
    const vigie = seed("vigie", "1.24.1");
    const response = await call("POST", `/${vigie.id}/update`);
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "plugin_requires_newer_server", required: "9.0.0" });
    expect(archive.downloads).toEqual([]);
    expect(getInstalled()[0].version).toBe("1.24.1");
  });
});
