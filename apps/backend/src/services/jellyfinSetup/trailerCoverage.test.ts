/**
 * Le compte des bandes-annonces : page par page, champs minimaux, plafonné,
 * gardé dix minutes par serveur — et oublié après une actualisation.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ url: "http://jf.test", calls: [] as string[], total: 1200, fail: false }));

vi.mock("../configStore", () => ({ getJellyfinUrl: () => env.url, getJellyfinApiKey: () => "cle" }));
vi.mock("../jellyfinAdminFetch", () => ({
  jellyfinAdminFetch: async (path: string) => {
    env.calls.push(path);
    if (env.fail) return { ok: false, failure: "unreachable" };
    const start = Number(new URL(`http://x${path}`).searchParams.get("StartIndex"));
    const count = Math.max(0, Math.min(500, env.total - start));
    // Un titre sur deux connu de TMDB, un sur quatre avec une bande-annonce.
    const Items = Array.from({ length: count }, (_, i) => {
      const n = start + i;
      return { ProviderIds: n % 2 === 0 ? { Tmdb: String(n) } : {}, RemoteTrailers: n % 4 === 0 ? [{ Url: "u" }] : [], LocalTrailerCount: 0 };
    });
    return { ok: true, data: { Items, TotalRecordCount: env.total } };
  },
}));

import { forgetTrailerCoverage, readTrailerCoverage } from "./trailerCoverage";

afterEach(() => {
  forgetTrailerCoverage();
  env.calls = [];
  env.total = 1200;
  env.fail = false;
  env.url = "http://jf.test";
});

describe("compte des bandes-annonces", () => {
  it("lit toutes les pages, avec les seuls champs utiles", async () => {
    expect(await readTrailerCoverage()).toEqual({ titles: 1200, withTmdb: 600, withTrailer: 300, sampled: false });
    expect(env.calls).toHaveLength(3);
    expect(env.calls[0]).toContain("Fields=RemoteTrailers,LocalTrailerCount,ProviderIds&EnableImages=false&EnableUserData=false");
  });

  it("plafonné à dix mille titres, et le dit", async () => {
    env.total = 25_000;
    expect(await readTrailerCoverage()).toMatchObject({ titles: 10_000, sampled: true });
    expect(env.calls).toHaveLength(20);
  });

  it("gardé dix minutes par serveur ; oublié sur demande", async () => {
    await readTrailerCoverage();
    await readTrailerCoverage();
    expect(env.calls).toHaveLength(3);
    env.url = "http://autre.test";
    await readTrailerCoverage();
    expect(env.calls).toHaveLength(6);
    forgetTrailerCoverage();
    await readTrailerCoverage();
    expect(env.calls).toHaveLength(9);
  });

  it("Jellyfin muet : rien de compté, rien de gardé", async () => {
    env.fail = true;
    expect(await readTrailerCoverage()).toBeNull();
    env.fail = false;
    expect(await readTrailerCoverage()).not.toBeNull();
  });
});
