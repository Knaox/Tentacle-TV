/**
 * Le rapport de compatibilité de bout en bout, contre un faux Jellyfin qui,
 * comme la 12.x, refuse l'autorisation historique : version installée et
 * dernière publiée jugées par le manifeste publié, sondes du serveur connecté.
 */

import { rmSync } from "fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => {
  const dir = `${process.env.TMPDIR ?? "/tmp"}/l32-report-${String(process.pid)}`;
  process.env.TENTACLE_DATA_DIR = dir;
  process.env.TENTACLE_COMPAT_MANIFEST_URL = "https://raw.test/compat/jellyfin.json";
  process.env.TENTACLE_JELLYFIN_RELEASES_URL = "https://gh.test/releases/latest";
  return { dir, config: new Map<string, string>(), jellyfin: { version: "10.11.8", up: true } };
});

vi.mock("../configStore", () => ({
  getJellyfinUrl: () => env.config.get("jellyfin_url"),
  getJellyfinApiKey: () => env.config.get("jellyfin_api_key"),
}));

import { buildCompatReport } from "./compatService";
import { resetLatestJellyfinForTests } from "./jellyfinReleases";
import { resetCompatManifestForTests } from "./manifestStore";
import { resetEndpointIndexForTests } from "./openApiProbe";

const MANIFEST = {
  schema: 1,
  revision: 7,
  generatedAt: "2026-09-29T12:00:00Z",
  lines: [{ id: "10.11", from: "10.11.0", until: "10.12.0" }, { id: "12", from: "12.0.0", until: "13.0.0" }],
  features: [
    { id: "auth.header", area: "auth", critical: true, label: { fr: "Connexion", en: "Sign-in" } },
    { id: "segments.api", area: "segments", label: { fr: "Passages", en: "Segments" }, endpoints: ["GET /MediaSegments/{itemId}"] },
    { id: "extras.trailers", area: "extras", label: { fr: "Bandes-annonces", en: "Trailers" }, endpoints: ["GET /Items/{itemId}/LocalTrailers"] },
  ],
  versions: [
    { version: "10.11.8", verdict: "ok", features: { "auth.header": "ok", "segments.api": "ok", "extras.trailers": "ok" } },
    {
      version: "12.1.0",
      verdict: "partial",
      features: { "auth.header": "ok", "segments.api": "ok", "extras.trailers": { verdict: "fail", note: { fr: "vides", en: "empty" } } },
    },
  ],
};

const OPENAPI = { paths: { "/MediaSegments/{itemId}": { get: {} }, "/System/Info": { get: {} } } };

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const network = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("https://raw.test/")) return json(MANIFEST);
  if (url.startsWith("https://gh.test/")) return json({ tag_name: "v12.1", published_at: "2026-09-15T01:23:53Z", draft: false, prerelease: false });
  if (!env.jellyfin.up) throw new TypeError("fetch failed");
  // Comme Jellyfin 12 : `X-Emby-Token` ne vaut plus rien, seul l'en-tête MediaBrowser passe.
  const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? "";
  if (auth !== 'MediaBrowser Token="cle-admin"') return new Response("", { status: 401 });
  if (url === "http://jf.test/System/Info") return json({ Version: env.jellyfin.version, ServerName: "Maison" });
  if (url === "http://jf.test/api-docs/openapi.json") return json(OPENAPI);
  return new Response("", { status: 404 });
});

beforeEach(() => {
  env.config.set("jellyfin_url", "http://jf.test");
  env.config.set("jellyfin_api_key", "cle-admin");
  env.jellyfin.version = "10.11.8";
  env.jellyfin.up = true;
  vi.stubGlobal("fetch", network);
});

afterEach(() => {
  vi.unstubAllGlobals();
  network.mockClear();
  env.config.clear();
  resetCompatManifestForTests();
  resetLatestJellyfinForTests();
  resetEndpointIndexForTests();
  rmSync(env.dir, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(env.dir, { recursive: true, force: true });
});

describe("rapport de compatibilité", () => {
  it("installée 10.11.8 : compatible, et les sondes disent ce que CE serveur publie", async () => {
    const report = await buildCompatReport();
    expect(report.manifest).toMatchObject({ revision: 7, source: "remote", testedVersions: ["10.11.8", "12.1.0"] });
    expect(report.installed).toMatchObject({ version: "10.11.8", serverName: "Maison", status: "compatible", probes: "ok" });
    const probes = Object.fromEntries((report.installed?.features ?? []).map((f) => [f.id, f.probe]));
    expect(probes).toEqual({
      "auth.header": null,
      "segments.api": { state: "present", missing: [] },
      "extras.trailers": { state: "missing", missing: ["GET /Items/{itemId}/LocalTrailers"] },
    });
  });

  it("dernière publiée 12.1 : plus récente, support incomplet, avec ce qui manque — et jamais sondée", async () => {
    const { latest } = await buildCompatReport();
    expect(latest).toMatchObject({
      version: "12.1",
      tag: "v12.1",
      newer: true,
      status: "partial",
      url: "https://github.com/jellyfin/jellyfin/releases/tag/v12.1",
    });
    expect(latest?.features.find((f) => f.id === "extras.trailers")).toMatchObject({ state: "fail", note: { fr: "vides" }, probe: null });
  });

  it("déjà sur la dernière : rien de plus récent", async () => {
    env.jellyfin.version = "12.1.0";
    const report = await buildCompatReport();
    expect(report.installed?.status).toBe("partial");
    expect(report.latest?.newer).toBe(false);
  });

  it("Jellyfin muet : on le dit, et la dernière publiée reste jugée", async () => {
    env.jellyfin.up = false;
    const report = await buildCompatReport();
    expect(report).toMatchObject({ installed: null, installedError: "unreachable", latest: { version: "12.1", newer: false } });
  });

  it("rien de configuré : « non configuré », sans appeler Jellyfin", async () => {
    env.config.clear();
    const report = await buildCompatReport();
    expect(report.installedError).toBe("not-configured");
    expect(network.mock.calls.some(([url]) => String(url).startsWith("http://jf.test"))).toBe(false);
  });

  it("une clé refusée se distingue d'un hôte muet", async () => {
    env.config.set("jellyfin_api_key", "revoquee");
    expect((await buildCompatReport()).installedError).toBe("rejected");
  });
});
