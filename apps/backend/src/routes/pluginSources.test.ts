/**
 * Les sources et le catalogue : ce que chaque source a donné à sa dernière
 * lecture, un registre qui hoquette sans vider le catalogue, et le plugin
 * publié par deux sources qui suit celle d'où il a été installé.
 */

import Fastify from "fastify";
import { mkdirSync, rmSync } from "fs";
import { ZodError } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/dataDir", async () => {
  const { tmpdir } = await import("os");
  const path = await import("path");
  return { DATA_ROOT: path.join(tmpdir(), `tentacle-plugin-sources-${process.pid}`) };
});

import { DATA_DIR, clearCache, getSources, saveCustomSources, saveInstalled } from "../services/pluginManager";
import { registerPluginSourceRoutes } from "./pluginSources";

const OFFICIAL_URL = getSources()[0].url;
const MIRROR_URL = "https://mirror.test/registry.json";

type Reply = { status: number; body?: unknown } | "network-error";
const registries = new Map<string, Reply>();

function registry(version: string, extra: Record<string, unknown> = {}) {
  return {
    plugins: [{
      id: "vigie", name: "Vigie", author: "Knaox", latestVersion: version,
      versions: [
        { version: "0.9.0", downloadUrl: "https://dl.test/old.tgz", checksum: "sha256:old" },
        { version, downloadUrl: `https://dl.test/${version}.tgz`, checksum: `sha256:${version}`, changelog: "### FR\n- neuf", releaseDate: "2026-09-20" },
      ],
      ...extra,
    }],
  };
}

async function call(method: "GET" | "POST", url: string, body?: unknown) {
  const app = Fastify();
  // Le gestionnaire d'erreurs du serveur (index.ts) : ZodError → 400.
  app.setErrorHandler((error, _request, reply) => {
    reply.status(error instanceof ZodError ? 400 : 500).send({ message: error instanceof Error ? error.message : "Error" });
  });
  registerPluginSourceRoutes(app);
  const response = await app.inject({ method, url, ...(body === undefined ? {} : { payload: body as object }) });
  await app.close();
  return response;
}

beforeEach(() => {
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });
  clearCache();
  registries.clear();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const reply = registries.get(String(input));
    if (!reply || reply === "network-error") throw new TypeError("fetch failed");
    return Response.json(reply.body ?? {}, { status: reply.status });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  rmSync(DATA_DIR, { recursive: true, force: true });
});

describe("catalogue", () => {
  it("lit la version annoncée avec SON archive, son empreinte et ses notes", async () => {
    registries.set(OFFICIAL_URL, { status: 200, body: registry("1.2.0") });
    const [entry] = (await call("GET", "/marketplace")).json();
    expect(entry).toMatchObject({
      pluginId: "vigie", version: "1.2.0",
      downloadUrl: "https://dl.test/1.2.0.tgz", checksum: "sha256:1.2.0",
      changelog: "### FR\n- neuf", releaseDate: "2026-09-20",
    });
  });

  it("ne propose pas de « mise à jour » vers une version plus ancienne", async () => {
    registries.set(OFFICIAL_URL, { status: 200, body: registry("1.2.0") });
    saveInstalled([{ id: "i-1", pluginId: "vigie", sourceId: "official", name: "Vigie", version: "1.3.0", enabled: true, config: {}, installedAt: "" }]);
    const [entry] = (await call("GET", "/marketplace")).json();
    expect(entry).toMatchObject({ installed: true, installedVersion: "1.3.0", updateAvailable: false });
  });

  it("un plugin publié par deux sources suit celle d'où il a été installé", async () => {
    registries.set(OFFICIAL_URL, { status: 200, body: registry("1.2.0") });
    registries.set(MIRROR_URL, { status: 200, body: registry("2.0.0") });
    saveCustomSources([{ id: "mirror", name: "Miroir", url: MIRROR_URL, official: false, enabled: true }]);

    expect((await call("GET", "/marketplace")).json()).toMatchObject([{ sourceId: "official", version: "1.2.0" }]);

    saveInstalled([{ id: "i-1", pluginId: "vigie", sourceId: "mirror", name: "Vigie", version: "1.0.0", enabled: true, config: {}, installedAt: "" }]);
    expect((await call("GET", "/marketplace")).json()).toMatchObject([{ sourceId: "mirror", version: "2.0.0", updateAvailable: true }]);

    // Sa source éteinte, l'officielle le publie encore : pas de « mise à jour »
    // que la route de mise à jour (qui lit le miroir) ne poserait pas.
    saveCustomSources([{ id: "mirror", name: "Miroir", url: MIRROR_URL, official: false, enabled: false }]);
    expect((await call("GET", "/marketplace")).json()).toMatchObject([{ sourceId: "official", installed: true, updateAvailable: false }]);
  });
});

describe("état de lecture des sources", () => {
  it("rien avant la première lecture, puis ce que le registre a donné", async () => {
    registries.set(OFFICIAL_URL, { status: 200, body: registry("1.2.0") });
    expect((await call("GET", "/sources")).json()[0].registry).toBeUndefined();
    await call("GET", "/marketplace");
    const [official] = (await call("GET", "/sources")).json();
    expect(official.registry).toMatchObject({ pluginCount: 1 });
    expect(official.registry.fetchedAt).toEqual(expect.any(String));
    expect(official.registry.error).toBeUndefined();
  });

  it("un registre qui hoquette garde sa dernière lecture réussie et le dit", async () => {
    registries.set(OFFICIAL_URL, { status: 200, body: registry("1.2.0") });
    await call("GET", "/marketplace");
    registries.set(OFFICIAL_URL, { status: 503 });

    const refresh = (await call("POST", "/sources/refresh")).json();
    expect(refresh).toMatchObject({ refreshed: 1, plugins: 1, failed: 1 });
    expect(refresh.sources[0].registry).toMatchObject({ pluginCount: 1, error: "Registry returned 503" });
    expect((await call("GET", "/marketplace")).json()).toHaveLength(1);
  });

  it("une source en échec se relit au bout de cinq minutes, pas de six heures", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    registries.set(OFFICIAL_URL, "network-error");
    await call("GET", "/marketplace");
    registries.set(OFFICIAL_URL, { status: 200, body: registry("1.2.0") });

    now.mockReturnValue(1_000_000 + 4 * 60_000);
    expect((await call("GET", "/marketplace")).json()).toEqual([]);
    now.mockReturnValue(1_000_000 + 5 * 60_000);
    expect((await call("GET", "/marketplace")).json()).toHaveLength(1);
  });
});

describe("POST /sources", () => {
  it("lit le registre à l'ajout et rend ce qu'il publie", async () => {
    registries.set(MIRROR_URL, { status: 200, body: registry("2.0.0") });
    const response = await call("POST", "/sources", { url: MIRROR_URL });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: "mirror.test", enabled: true, registry: { pluginCount: 1 } });
  });

  it("une adresse injoignable s'ajoute, avec son erreur", async () => {
    const response = await call("POST", "/sources", { url: MIRROR_URL, name: "Miroir" });
    expect(response.json()).toMatchObject({ name: "Miroir", registry: { pluginCount: 0, error: "fetch failed" } });
  });

  it("refuse ce qui n'est pas du HTTP(S), et une adresse déjà présente", async () => {
    expect((await call("POST", "/sources", { url: "ftp://mirror.test/registry.json" })).statusCode).toBe(400);
    expect((await call("POST", "/sources", { url: OFFICIAL_URL })).statusCode).toBe(409);
  });
});
