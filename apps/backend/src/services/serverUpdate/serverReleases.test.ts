/**
 * La dernière version publiée du serveur, lue sur GitHub : par les tags, la
 * publication du plus haut (et le précédent si elle manque), `minServer`,
 * les requêtes conditionnelles, le quota et la mémoire hors ligne.
 */

import { rmSync } from "fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le dossier de données et les adresses sont fixés AVANT les imports : `DATA_ROOT` se lit au chargement.
const dir = vi.hoisted(() => {
  const path = `${process.env.TMPDIR ?? "/tmp"}/t1-server-releases-${String(process.pid)}`;
  process.env.TENTACLE_DATA_DIR = path;
  process.env.TENTACLE_SERVER_UPDATE_REPO = "https://api.github.com/repos/Knaox/Tentacle-TV";
  process.env.TENTACLE_SERVER_UPDATE_VERSIONS_URL = "https://raw.test/versions.json";
  return path;
});

import { getServerReleaseState, readTagVersions, refreshServerRelease, resetServerReleaseForTests } from "./serverReleases";
import { buildServerUpdateReport } from "./serverUpdateReport";

const API = "https://api.github.com/repos/Knaox/Tentacle-TV";
const refs = (...tags: string[]) => tags.map((tag) => ({ ref: `refs/tags/${tag}` }));
const release = (version: string, extra: Record<string, unknown> = {}) => ({
  tag_name: `server-v${version}`,
  published_at: "2026-10-02T19:17:25Z",
  draft: false,
  prerelease: false,
  html_url: "https://evil.test",
  body: "### FR\n- **Une nouveauté qui compte vraiment** : détail.\n### EN\n- **A feature that really matters**: detail.",
  ...extra,
});

/** Le faux GitHub : une réponse par adresse, comptée. */
let routes: Record<string, () => Response> = {};
const calls: string[] = [];
const json = (body: unknown, etag = '"e1"') =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", etag } });
const status = (code: number) => new Response(null, { status: code });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(`${url}${(init?.headers as Record<string, string> | undefined)?.["If-None-Match"] ? " (conditionnelle)" : ""}`);
    const route = routes[url];
    return route ? route() : status(404);
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  routes = {};
  calls.length = 0;
  resetServerReleaseForTests();
  rmSync(dir, { recursive: true, force: true });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function github(versions: { tags: string[]; releases: Record<string, unknown>; minServer?: string }) {
  routes[`${API}/git/matching-refs/tags/server-v`] = () => json(refs(...versions.tags));
  for (const [version, body] of Object.entries(versions.releases)) {
    routes[`${API}/releases/tags/server-v${version}`] = () => json(body);
  }
  routes["https://raw.test/versions.json"] = () => json({ server: "x", minServer: versions.minServer ?? "1.22.1" });
}

describe("les tags du serveur", () => {
  it("ne garde que server-vX.Y.Z, triés du plus récent au plus ancien", () => {
    expect(readTagVersions(refs("server-v1.9.0", "server-v1.22.2-webos-1.0.1", "desktop-v1.25.5", "server-v1.22.10", "server-v1.22.2")))
      .toEqual(["1.22.10", "1.22.2", "1.9.0"]);
    expect(readTagVersions({ message: "Not Found" })).toBeNull();
  });
});

describe("la dernière publication", () => {
  it("le plus haut tag, ses notes réduites, la page construite ici, minServer lu", async () => {
    github({ tags: ["server-v1.22.2", "server-v1.22.4", "server-v1.22.3"], releases: { "1.22.4": release("1.22.4") }, minServer: "1.22.3" });
    await refreshServerRelease();
    const held = getServerReleaseState();
    expect(held.error).toBeNull();
    expect(held.latest).toEqual({
      version: "1.22.4",
      tag: "server-v1.22.4",
      publishedAt: "2026-10-02T19:17:25Z",
      url: "https://github.com/Knaox/Tentacle-TV/releases/tag/server-v1.22.4",
      highlights: { fr: ["Une nouveauté qui compte vraiment"], en: ["A feature that really matters"] },
    });
    expect(held.minServer).toBe("1.22.3");
    expect(held.versions).toEqual(["1.22.4", "1.22.3", "1.22.2"]);
  });

  it("un tag sans publication sortie (404), une version candidate : le précédent", async () => {
    github({
      tags: ["server-v1.23.0", "server-v1.22.5", "server-v1.22.4"],
      releases: { "1.22.5": release("1.22.5", { prerelease: true }), "1.22.4": release("1.22.4") },
    });
    await refreshServerRelease();
    expect(getServerReleaseState().latest?.version).toBe("1.22.4");
  });

  it("quota épuisé : la dernière connue reste, l'erreur est dite", async () => {
    github({ tags: ["server-v1.22.4"], releases: { "1.22.4": release("1.22.4") } });
    await refreshServerRelease();
    routes[`${API}/git/matching-refs/tags/server-v`] = () => status(403);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);
    await refreshServerRelease(true);
    expect(getServerReleaseState()).toMatchObject({ latest: { version: "1.22.4" }, error: "rate-limited" });
  });

  it("six heures de répit, une minute pour « Revérifier », puis une requête conditionnelle", async () => {
    github({ tags: ["server-v1.22.4"], releases: { "1.22.4": release("1.22.4") } });
    await refreshServerRelease();
    await refreshServerRelease();
    await refreshServerRelease(true);
    expect(calls.filter((url) => url.includes("matching-refs"))).toHaveLength(1);
    routes[`${API}/git/matching-refs/tags/server-v`] = () => status(304);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);
    await refreshServerRelease(true);
    expect(calls.at(-2)).toBe(`${API}/git/matching-refs/tags/server-v (conditionnelle)`);
    expect(getServerReleaseState()).toMatchObject({ latest: { version: "1.22.4" }, error: null });
  });

  it("hors ligne au démarrage suivant : la dernière connue, relue du disque", async () => {
    github({ tags: ["server-v1.22.4"], releases: { "1.22.4": release("1.22.4") } });
    await refreshServerRelease();
    resetServerReleaseForTests();
    routes = {};
    await refreshServerRelease();
    expect(getServerReleaseState()).toMatchObject({ latest: { version: "1.22.4" }, minServer: "1.22.1", error: "unreachable" });
  });
});

describe("le rapport de la carte", () => {
  it("compte les versions publiées depuis celle en service, et dit l'installation", async () => {
    github({ tags: ["server-v1.22.4", "server-v1.22.3", "server-v99.0.0"], releases: { "99.0.0": release("99.0.0") } });
    const report = await buildServerUpdateReport(false);
    expect(report.latest?.version).toBe("99.0.0");
    expect(report.behind).toBeGreaterThanOrEqual(1);
    expect(report.bootId).toMatch(/^[0-9a-f-]{36}$/);
    expect(report.install.repository).toBe("ghcr.io/knaox/tentacle-tv");
  });

  it("vérification coupée : rien n'est demandé à GitHub, et le rapport le dit", async () => {
    process.env.TENTACLE_SERVER_UPDATE_REPO = "off";
    try {
      const report = await buildServerUpdateReport(true);
      expect(report).toMatchObject({ latest: null, error: "off", behind: 0 });
      expect(calls).toEqual([]);
    } finally {
      process.env.TENTACLE_SERVER_UPDATE_REPO = API;
    }
  });
});
