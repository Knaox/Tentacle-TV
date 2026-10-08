/**
 * UNE règle pour dire qu'une extension sert (`isPluginUsable`), appliquée par
 * toutes les portes du cœur : la liste servie aux clients, son bundle, les
 * demandes de titres (droit d'invité), et la configuration de Vigie que lisent
 * les recommandations et l'accueil. Une Vigie refusée (sans `storage.sqlite`)
 * disparaît de partout à la fois ; déclarée, elle revient partout.
 */

import Fastify from "fastify";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../dataDir", async () => {
  const { tmpdir } = await import("os");
  const path = await import("path");
  return { DATA_ROOT: path.join(tmpdir(), `tentacle-usable-plugins-${process.pid}`) };
});
vi.mock("../../middleware/auth", () => ({
  requireAuth: async () => {},
  requireAdmin: async () => {},
}));

import { DATA_DIR, saveInstalled } from "../pluginManager";
import { getSeerrConfig } from "../seerConfig";
import { forgetRequestExtension, hasRequestExtension } from "../pluginRequests";
import { isPluginUsable, usablePlugins } from "./gate";
import { pluginRoutes } from "../../routes/plugins";

const VIGIE_CONFIG = { enabled: true, url: "http://seerr.test/", apiKey: "k" };

function installVigie(manifest: Record<string, unknown>, enabled = true): void {
  saveInstalled([{
    id: "11111111-1111-4111-8111-111111111111", pluginId: "seer", sourceId: "official", name: "Vigie",
    version: "1.24.1", enabled, config: VIGIE_CONFIG, installedAt: "2026-10-08T00:00:00.000Z",
  }]);
  const dir = join(DATA_DIR, "seer");
  mkdirSync(join(dir, "dist"), { recursive: true });
  writeFileSync(join(dir, "plugin.json"), JSON.stringify({
    server: "server/index.mjs", titles: { state: "/titles/state", request: "/titles/request" }, ...manifest,
  }));
  writeFileSync(join(dir, "dist", "plugin-seer.iife.js"), "/* bundle */");
  forgetRequestExtension();
}

async function call(url: string) {
  const app = Fastify();
  await app.register(pluginRoutes, { prefix: "/api/plugins" });
  const response = await app.inject({ method: "GET", url });
  await app.close();
  return response;
}

beforeEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });
});
afterEach(() => rmSync(DATA_DIR, { recursive: true, force: true }));

describe("une Vigie refusée (sans storage.sqlite) disparaît de partout", () => {
  beforeEach(() => installVigie({}));

  it("ni règle, ni liste, ni bundle, ni demandes, ni configuration", async () => {
    expect(usablePlugins()).toEqual([]);
    expect((await call("/api/plugins/active")).json()).toEqual([]);
    expect((await call("/api/plugins/seer/bundle")).statusCode).toBe(404);
    expect(hasRequestExtension()).toBe(false);
    expect(getSeerrConfig()).toBeNull();
  });
});

describe("déclarée compatible, elle revient partout", () => {
  beforeEach(() => installVigie({ storage: { sqlite: true } }));

  it("règle, liste, bundle, demandes et configuration", async () => {
    expect(usablePlugins().map((p) => p.pluginId)).toEqual(["seer"]);
    const [active] = (await call("/api/plugins/active")).json() as Array<Record<string, unknown>>;
    expect(active).toMatchObject({ pluginId: "seer", titles: { state: "/titles/state" } });
    expect((await call("/api/plugins/seer/bundle")).statusCode).toBe(200);
    expect(hasRequestExtension()).toBe(true);
    expect(getSeerrConfig()).toEqual({ url: "http://seerr.test", apiKey: "k" });
  });

  it("désactivée : la même règle la retire", async () => {
    installVigie({ storage: { sqlite: true } }, false);
    expect(isPluginUsable({ pluginId: "seer", enabled: false })).toBe(false);
    expect((await call("/api/plugins/seer/bundle")).statusCode).toBe(404);
    expect(getSeerrConfig()).toBeNull();
  });
});
