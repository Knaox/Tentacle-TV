/**
 * Les plugins installés et la règle de redémarrage : ce que la liste annonce
 * AVANT le geste, ce que chaque geste déclenche vraiment, et ce qui est
 * refusé pendant qu'un redémarrage est en route.
 */

import Fastify from "fastify";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/dataDir", async () => {
  const { tmpdir } = await import("os");
  const path = await import("path");
  return { DATA_ROOT: path.join(tmpdir(), `tentacle-plugin-routes-${process.pid}`) };
});

const restart = vi.hoisted(() => ({ pending: false, reasons: [] as string[] }));
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
import { pluginBackendDiag } from "../services/pluginBackendLoader";
import { registerPluginInstalledRoutes } from "./pluginInstalled";

const REGISTRY = {
  plugins: [
    {
      id: "vigie",
      name: "Vigie",
      latestVersion: "1.2.0",
      versions: [{ version: "1.2.0", downloadUrl: "https://registry.test/vigie-1.2.0.tgz", checksum: "sha256:ab" }],
    },
  ],
};

function seed(pluginId: string, opts: { enabled?: boolean; version?: string; server?: boolean } = {}): InstalledPlugin {
  const plugin: InstalledPlugin = {
    id: randomUUID(), pluginId, sourceId: "official", name: pluginId,
    version: opts.version ?? "1.0.0", enabled: opts.enabled ?? true, config: {},
    installedAt: "2026-09-01T00:00:00.000Z",
  };
  saveInstalled([...getInstalled(), plugin]);
  mkdirSync(join(DATA_DIR, pluginId), { recursive: true });
  writeFileSync(join(DATA_DIR, pluginId, "plugin.json"), JSON.stringify(opts.server ? { server: "server/index.mjs" } : {}));
  return plugin;
}

async function call(method: "GET" | "POST" | "PUT" | "DELETE", url: string, body?: unknown) {
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
  restart.pending = false;
  restart.reasons = [];
  archive.withServer = true;
  archive.downloads = [];
  pluginBackendDiag.loadResults = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(REGISTRY)));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  rmSync(DATA_DIR, { recursive: true, force: true });
});

describe("GET / — ce que la liste annonce", () => {
  it("dit l'état du module serveur et quand un geste redémarre", async () => {
    seed("vigie", { server: true });
    seed("calendar", { server: true, enabled: false });
    seed("notes", { server: true });
    seed("theme");
    seed("broken", { server: true });
    pluginBackendDiag.loadResults = [
      { pluginId: "vigie", status: "loaded" },
      { pluginId: "calendar", status: "loaded" },
      { pluginId: "broken", status: "error", detail: "Cannot find module 'x'" },
    ];

    const list = (await call("GET", "/")).json() as Array<Record<string, unknown>>;
    const byId = Object.fromEntries(list.map((p) => [p.pluginId, p]));

    expect(byId.vigie).toMatchObject({ serverModule: { state: "running" }, restartRequired: false, restartsOn: { update: true, uninstall: true } });
    // Désactivé, mais son module tourne encore : l'arrêter demande un redémarrage.
    expect(byId.calendar).toMatchObject({ serverModule: { state: "running" }, restartRequired: true, restartsOn: { update: false, uninstall: true } });
    // Activé depuis le démarrage : rien de chargé, il faut redémarrer pour le lancer.
    expect(byId.notes).toMatchObject({ serverModule: { state: "idle" }, restartRequired: true, restartsOn: { update: true, uninstall: false } });
    expect(byId.theme).toMatchObject({ serverModule: { state: "none" }, restartRequired: false, restartsOn: { update: false, uninstall: false } });
    expect(byId.broken).toMatchObject({
      serverModule: { state: "failed", detail: "Cannot find module 'x'" },
      restartRequired: false,
      restartsOn: { uninstall: true },
    });
  });
});

describe("POST /install", () => {
  it("un module serveur programme le redémarrage et le dit", async () => {
    const response = await call("POST", "/install", { pluginId: "vigie", version: "1.2.0", sourceId: "official" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ pluginId: "vigie", name: "Vigie", restartScheduled: true, bootId: "boot-test" });
    expect(restart.reasons).toHaveLength(1);
    expect(getInstalled().map((p) => p.pluginId)).toEqual(["vigie"]);
  });

  it("sans module serveur, rien ne redémarre", async () => {
    archive.withServer = false;
    const response = await call("POST", "/install", { pluginId: "vigie", version: "1.2.0", sourceId: "official" });
    expect(response.json()).toMatchObject({ restartScheduled: false });
    expect(restart.reasons).toEqual([]);
  });

  it("une version que la source ne publie plus n'enregistre pas de plugin fantôme", async () => {
    const response = await call("POST", "/install", { pluginId: "vigie", version: "1.1.0", sourceId: "official" });
    expect(response.statusCode).toBe(404);
    expect(getInstalled()).toEqual([]);
    expect(archive.downloads).toEqual([]);
  });

  it("refuse pendant qu'un redémarrage est en route", async () => {
    restart.pending = true;
    const response = await call("POST", "/install", { pluginId: "vigie", version: "1.2.0", sourceId: "official" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ restartScheduled: true, bootId: "boot-test" });
    expect(getInstalled()).toEqual([]);
  });
});

describe("DELETE /:id", () => {
  it("un module chargé ne disparaît qu'au redémarrage", async () => {
    const vigie = seed("vigie", { server: true });
    pluginBackendDiag.loadResults = [{ pluginId: "vigie", status: "loaded" }];
    const response = await call("DELETE", `/${vigie.id}`);
    expect(response.json()).toEqual({ success: true, restartScheduled: true, bootId: "boot-test" });
    expect(getInstalled()).toEqual([]);
  });

  it("un module jamais chargé part sans redémarrage", async () => {
    const notes = seed("notes", { server: true, enabled: false });
    const response = await call("DELETE", `/${notes.id}`);
    expect(response.json()).toMatchObject({ success: true, restartScheduled: false });
    expect(restart.reasons).toEqual([]);
  });
});

describe("POST /:id/update", () => {
  it("n'installe pas une version plus ancienne que celle en place", async () => {
    const vigie = seed("vigie", { server: true, version: "1.3.0" });
    const response = await call("POST", `/${vigie.id}/update`);
    expect(response.json()).toMatchObject({ message: "Already up to date", restartScheduled: false });
    expect(archive.downloads).toEqual([]);
    expect(getInstalled()[0].version).toBe("1.3.0");
  });

  it("met à jour et redémarre un module actif", async () => {
    const vigie = seed("vigie", { server: true });
    const response = await call("POST", `/${vigie.id}/update`);
    expect(response.json()).toMatchObject({ version: "1.2.0", restartScheduled: true });
    expect(getInstalled()[0].version).toBe("1.2.0");
  });

  it("une seconde mise à jour du même plugin est refusée, même pendant la lecture du registre", async () => {
    const vigie = seed("vigie", { server: true });
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = vi.fn(async () => {
      await gate;
      return Response.json(REGISTRY);
    });
    vi.stubGlobal("fetch", fetchMock);
    const app = Fastify();
    registerPluginInstalledRoutes(app);

    const first = app.inject({ method: "POST", url: `/${vigie.id}/update` });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // La première attend encore le registre : la seconde doit répondre sans l'attendre.
    const second = await Promise.race([
      app.inject({ method: "POST", url: `/${vigie.id}/update` }),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 300)),
    ]);
    expect(second === "pending" ? second : second.statusCode).toBe(409);

    release();
    expect((await first).json()).toMatchObject({ version: "1.2.0" });
    await app.close();
  });

  it("un plugin désactivé se met à jour sans redémarrer le serveur", async () => {
    const vigie = seed("vigie", { server: true, enabled: false });
    const response = await call("POST", `/${vigie.id}/update`);
    expect(response.json()).toMatchObject({ version: "1.2.0", restartScheduled: false });
    expect(restart.reasons).toEqual([]);
  });
});

describe("PUT /:id/toggle et POST /restart", () => {
  it("l'activation d'un module serveur annonce le redémarrage à faire, sans le faire", async () => {
    const notes = seed("notes", { server: true, enabled: false });
    const response = await call("PUT", `/${notes.id}/toggle`);
    expect(response.json()).toMatchObject({ enabled: true, restartRequired: true });
    expect(restart.reasons).toEqual([]);
  });

  it("le redémarrage demandé se programme et rend l'identifiant du processus", async () => {
    const response = await call("POST", "/restart");
    expect(response.json()).toEqual({ restartScheduled: true, bootId: "boot-test" });
    expect(restart.reasons).toHaveLength(1);
  });
});
