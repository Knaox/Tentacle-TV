/**
 * Le service des sources de segments : économie de requêtes (greffon consulté
 * seulement quand il le faut), cache TTL, stale-on-error. Jellyfin est un faux
 * fetch global — aucune décision de résolution n'est testée ici (elle vit dans
 * le résolveur partagé).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "admin-key",
}));

import { clearSegmentSourceCache, getSegmentSourceBundle } from "./jellyfinSegments";

type Scenario = Array<[RegExp, { status?: number; json?: unknown } | "reject"]>;

let scenario: Scenario = [];
let appels: string[] = [];

beforeEach(() => {
  clearSegmentSourceCache();
  scenario = [];
  appels = [];
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-28T10:00:00Z"));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entree: RequestInfo | URL) => {
      const url = String(entree);
      appels.push(url);
      for (const [motif, reponse] of scenario) {
        if (!motif.test(url)) continue;
        if (reponse === "reject") throw new Error("réseau coupé");
        return new Response(JSON.stringify(reponse.json ?? null), {
          status: reponse.status ?? 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const ITEM = { Type: "Episode", RunTimeTicks: 14_400_000_000, Chapters: [] };
const NATIF = { Items: [{ Type: "Intro", StartTicks: 0, EndTicks: 900_000_000 }] };

describe("getSegmentSourceBundle", () => {
  it("item + segments natifs : durée en ms, greffon jamais consulté", async () => {
    scenario = [
      [/\/Items\//, { json: ITEM }],
      [/\/MediaSegments\//, { json: NATIF }],
    ];
    const bundle = await getSegmentSourceBundle("ep-1");
    expect(bundle.runtimeMs).toBe(1_440_000);
    expect(bundle.sources.mediaSegments).toEqual(NATIF);
    expect(appels.some((u) => u.includes("IntroSkipperSegments"))).toBe(false);
    expect(appels.some((u) => u.includes("Timestamps"))).toBe(false);
  });

  it("natif muet + épisode : le dictionnaire suffit, pas de Timestamps", async () => {
    scenario = [
      [/\/Items\//, { json: ITEM }],
      [/\/MediaSegments\//, { json: { Items: [] } }],
      [/IntroSkipperSegments/, { json: { Introduction: { start: 0, end: 90 } } }],
    ];
    const bundle = await getSegmentSourceBundle("ep-2");
    expect(bundle.sources.pluginDict).toEqual({ Introduction: { start: 0, end: 90 } });
    expect(appels.some((u) => u.endsWith("/Timestamps"))).toBe(false);
  });

  it("dictionnaire inexploitable : les propriétés nommées prennent le relais", async () => {
    scenario = [
      [/\/Items\//, { json: ITEM }],
      [/\/MediaSegments\//, { json: { Items: [] } }],
      [/IntroSkipperSegments/, { status: 404 }],
      [/\/Timestamps$/, { json: { credits: { start: 1300, end: 1440 } } }],
    ];
    const bundle = await getSegmentSourceBundle("ep-3");
    expect(bundle.sources.pluginTimestamps).toEqual({ credits: { start: 1300, end: 1440 } });
  });

  it("un film ne consulte jamais les routes du greffon", async () => {
    scenario = [
      [/\/Items\//, { json: { ...ITEM, Type: "Movie" } }],
      [/\/MediaSegments\//, { json: { Items: [] } }],
    ];
    await getSegmentSourceBundle("film-1");
    expect(appels.some((u) => u.includes("/Episode/"))).toBe(false);
  });

  it("cache : un second appel dans le TTL ne refait aucune requête", async () => {
    scenario = [
      [/\/Items\//, { json: ITEM }],
      [/\/MediaSegments\//, { json: NATIF }],
    ];
    await getSegmentSourceBundle("ep-4");
    const avant = appels.length;
    await getSegmentSourceBundle("ep-4");
    expect(appels.length).toBe(avant);
  });

  it("TTL écoulé : la photo est reprise", async () => {
    scenario = [
      [/\/Items\//, { json: ITEM }],
      [/\/MediaSegments\//, { json: NATIF }],
    ];
    await getSegmentSourceBundle("ep-5");
    const avant = appels.length;
    vi.setSystemTime(new Date("2026-08-28T10:01:01Z"));
    await getSegmentSourceBundle("ep-5");
    expect(appels.length).toBeGreaterThan(avant);
  });

  it("stale-on-error : Jellyfin muet sert la dernière photo connue", async () => {
    scenario = [
      [/\/Items\//, { json: ITEM }],
      [/\/MediaSegments\//, { json: NATIF }],
    ];
    const frais = await getSegmentSourceBundle("ep-6");
    vi.setSystemTime(new Date("2026-08-28T10:01:01Z"));
    scenario = [[/./, "reject"]];
    const stale = await getSegmentSourceBundle("ep-6");
    expect(stale).toEqual(frais);
  });

  it("échec total sans photo : du vide, jamais mis en cache", async () => {
    scenario = [[/./, "reject"]];
    const vide = await getSegmentSourceBundle("ep-7");
    expect(vide).toEqual({ runtimeMs: 0, sources: {} });

    scenario = [
      [/\/Items\//, { json: ITEM }],
      [/\/MediaSegments\//, { json: NATIF }],
    ];
    const repris = await getSegmentSourceBundle("ep-7");
    expect(repris.runtimeMs).toBe(1_440_000);
  });
});
