import { describe, expect, it, vi } from "vitest";

/**
 * Le tissage des rangées globales : tendances (si TMDB ou Vigie) après « À
 * découvrir », pouls avant l'exploration, et « Les mieux notés de votre
 * bibliothèque » en fin — sur les pages personnalisées comme sur la liste de
 * repli, puisque l'accueil peut l'activer quel que soit l'état du compte.
 */
const seerr = vi.hoisted(() => ({ value: null as { url: string } | null }));
vi.mock("../db", () => ({ getPrisma: () => ({}) }));
vi.mock("../seerConfig", () => ({ getSeerrConfig: () => seerr.value }));

import { fallbackRowList, weaveGlobalRows } from "./globalRows";

const ctx = (tmdbConfigured: boolean) => ({ exclude: new Set<string>(), includeVigie: true, tmdbConfigured });
const PERSONALIZED = [
  { key: "forYou" }, { key: "inLibrary" }, { key: "discover" }, { key: "community" }, { key: "exploration" },
];

describe("weaveGlobalRows", () => {
  it("tendances après « À découvrir », pouls avant l'exploration, mieux notés en fin", () => {
    seerr.value = null;
    expect(weaveGlobalRows(PERSONALIZED, ctx(true)).map((r) => r.key)).toEqual([
      "forYou", "inLibrary", "discover", "trending", "community", "serverPulse", "exploration", "bestOfLibrary",
    ]);
  });

  it("sans TMDB ni Vigie, pas de tendances — la page finit quand même par les mieux notés", () => {
    seerr.value = null;
    expect(weaveGlobalRows(PERSONALIZED, ctx(false)).map((r) => r.key)).toEqual([
      "forYou", "inLibrary", "discover", "community", "serverPulse", "exploration", "bestOfLibrary",
    ]);
  });

  it("sans « À découvrir », les tendances suivent « Disponible dans votre bibliothèque »", () => {
    seerr.value = null;
    const rows = weaveGlobalRows([{ key: "forYou" }, { key: "inLibrary" }, { key: "exploration" }], ctx(true));
    expect(rows.map((r) => r.key)).toEqual([
      "forYou", "inLibrary", "trending", "serverPulse", "exploration", "bestOfLibrary",
    ]);
  });
});

describe("fallbackRowList", () => {
  it("tendances seulement si TMDB ou Vigie ; pouls et mieux notés toujours", () => {
    seerr.value = null;
    expect(fallbackRowList(ctx(false)).map((r) => r.key)).toEqual(["serverPulse", "bestOfLibrary"]);
    expect(fallbackRowList(ctx(true)).map((r) => r.key)).toEqual(["trending", "serverPulse", "bestOfLibrary"]);
    seerr.value = { url: "http://seer.test" };
    expect(fallbackRowList(ctx(false)).map((r) => r.key)).toEqual(["trending", "serverPulse", "bestOfLibrary"]);
  });
});
