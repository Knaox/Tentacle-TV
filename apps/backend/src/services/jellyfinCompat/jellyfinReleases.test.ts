/**
 * La dernière version stable de Jellyfin, lue sur GitHub : ce qui en est
 * retenu, la requête conditionnelle, le quota, et la mémoire hors ligne.
 */

import { rmSync } from "fs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le dossier de données est fixé AVANT les imports (vi.hoisted) : `DATA_ROOT` se lit au chargement.
const dir = vi.hoisted(() => {
  const path = `${process.env.TMPDIR ?? "/tmp"}/l32-releases-${String(process.pid)}`;
  process.env.TENTACLE_DATA_DIR = path;
  process.env.TENTACLE_JELLYFIN_RELEASES_URL = "https://gh.test/releases/latest";
  return path;
});

import { getLatestJellyfin, readRelease, refreshLatestJellyfin, resetLatestJellyfinForTests } from "./jellyfinReleases";

const RELEASE = { tag_name: "v12.1", name: "12.1", published_at: "2026-09-15T01:23:53Z", draft: false, prerelease: false, html_url: "https://evil.test" };

const github = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", github);
});

/** Une minute et une seconde plus tard : un « Revérifier » est de nouveau permis. */
function aMinuteLater() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + 61_000);
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  github.mockReset();
  resetLatestJellyfinForTests();
  rmSync(dir, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", etag: '"e1"' }, ...init });

describe("lecture d'une publication", () => {
  it("garde la version sans le v, et construit elle-même le lien des notes", () => {
    expect(readRelease(RELEASE)).toEqual({
      version: "12.1",
      tag: "v12.1",
      publishedAt: "2026-09-15T01:23:53Z",
      url: "https://github.com/jellyfin/jellyfin/releases/tag/v12.1",
    });
  });

  it("refuse brouillons, versions candidates et tags illisibles", () => {
    expect(readRelease({ ...RELEASE, prerelease: true })).toBeNull();
    expect(readRelease({ ...RELEASE, draft: true })).toBeNull();
    expect(readRelease({ ...RELEASE, tag_name: "v12.0-rc7" })).toBeNull();
    expect(readRelease(null)).toBeNull();
  });
});

describe("relecture", () => {
  it("lit, garde sur disque, et s'en souvient après un redémarrage hors ligne", async () => {
    github.mockResolvedValueOnce(json(RELEASE));
    await refreshLatestJellyfin();
    expect(getLatestJellyfin()).toMatchObject({ release: { version: "12.1" }, error: null });
    const checkedAt = getLatestJellyfin().checkedAt;

    resetLatestJellyfinForTests();
    github.mockRejectedValueOnce(new TypeError("fetch failed"));
    await refreshLatestJellyfin();
    expect(getLatestJellyfin()).toMatchObject({ release: { version: "12.1" }, checkedAt, error: "unreachable" });
  });

  it("requête conditionnelle : un 304 confirme la version connue", async () => {
    github.mockResolvedValueOnce(json(RELEASE));
    await refreshLatestJellyfin();
    github.mockResolvedValueOnce(new Response(null, { status: 304 }));
    aMinuteLater();
    await refreshLatestJellyfin(true);
    const [, init] = github.mock.calls[1] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["If-None-Match"]).toBe('"e1"');
    expect(getLatestJellyfin()).toMatchObject({ release: { version: "12.1" }, error: null });
  });

  it("quota épuisé : on le dit, sans oublier ce qu'on sait", async () => {
    github.mockResolvedValueOnce(json(RELEASE));
    await refreshLatestJellyfin();
    github.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    aMinuteLater();
    await refreshLatestJellyfin(true);
    expect(getLatestJellyfin()).toMatchObject({ release: { version: "12.1" }, error: "rate-limited" });
  });

  it("ne relit pas avant six heures, ni plus d'une fois par minute même forcé", async () => {
    github.mockResolvedValue(json(RELEASE));
    await refreshLatestJellyfin();
    await refreshLatestJellyfin();
    await refreshLatestJellyfin(true);
    expect(github).toHaveBeenCalledTimes(1);
  });

  it("une réponse qui n'est pas une publication stable ne remplace rien", async () => {
    github.mockResolvedValueOnce(json({ ...RELEASE, prerelease: true }));
    await refreshLatestJellyfin();
    expect(getLatestJellyfin()).toMatchObject({ release: null, error: "invalid" });
  });
});
