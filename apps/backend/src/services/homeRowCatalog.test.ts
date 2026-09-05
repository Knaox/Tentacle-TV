import { describe, expect, it, vi } from "vitest";

/**
 * Le catalogue des rangées : ce que chaque combinaison de capacités laisse
 * proposer, et ce qu'elle active d'entrée — sans clé TMDB, les rangées
 * génériques tiennent la place de « Pour vous ».
 */
const caps = vi.hoisted(() => ({ tmdb: true, seerr: null as { url: string } | null }));
vi.mock("./tmdb/client", () => ({ tmdbConfigured: () => caps.tmdb }));
vi.mock("./seerConfig", () => ({ getSeerrConfig: () => caps.seerr }));

import { HOME_ROW_KEYS, homeRowCatalog, isKnownHomeRowKey, serverHomeRowCapabilities } from "./homeRowCatalog";

const keys = (rows: { key: string }[]) => rows.map((r) => r.key);
const enabledKeys = (rows: { key: string; enabled: boolean }[]) => rows.filter((r) => r.enabled).map((r) => r.key);

describe("homeRowCatalog", () => {
  it("TMDB et Vigie : tout, « Pour vous » active, les génériques éteintes", () => {
    const rows = homeRowCatalog({ tmdb: true, vigie: true });
    expect(keys(rows)).toEqual([...HOME_ROW_KEYS]);
    expect(enabledKeys(rows)).toEqual(["resume", "nextUp", "reco:forYou", "watched", "watchlist"]);
  });

  it("sans TMDB : les rangées personnalisées disparaissent, le pouls et les mieux notés prennent le relais", () => {
    const rows = homeRowCatalog({ tmdb: false, vigie: true });
    expect(keys(rows)).toEqual([
      "resume", "nextUp", "watched", "watchlist", "favorites",
      "reco:trending", "reco:serverPulse", "reco:bestOfLibrary",
    ]);
    expect(enabledKeys(rows)).toEqual([
      "resume", "nextUp", "watched", "watchlist", "reco:serverPulse", "reco:bestOfLibrary",
    ]);
  });

  it("sans TMDB ni Vigie : pas de tendances non plus", () => {
    expect(keys(homeRowCatalog({ tmdb: false, vigie: false }))).not.toContain("reco:trending");
  });

  it("TMDB sans Vigie : pas d'« À découvrir », les tendances restent", () => {
    const k = keys(homeRowCatalog({ tmdb: true, vigie: false }));
    expect(k).not.toContain("reco:discover");
    expect(k).toContain("reco:trending");
  });
});

describe("isKnownHomeRowKey", () => {
  it("clés statiques et bibliothèques, rien d'autre", () => {
    expect(isKnownHomeRowKey("reco:forYou")).toBe(true);
    expect(isKnownHomeRowKey("favorites")).toBe(true);
    expect(isKnownHomeRowKey("library:0a1b-2c3d")).toBe(true);
    expect(isKnownHomeRowKey("reco:banana")).toBe(false);
    expect(isKnownHomeRowKey("library:")).toBe(false);
  });
});

describe("serverHomeRowCapabilities", () => {
  it("lit la clé TMDB et le plugin Vigie du serveur", () => {
    caps.tmdb = false;
    caps.seerr = { url: "http://seer.test" };
    expect(serverHomeRowCapabilities()).toEqual({ tmdb: false, vigie: true });
    caps.tmdb = true;
    caps.seerr = null;
    expect(serverHomeRowCapabilities()).toEqual({ tmdb: true, vigie: false });
  });
});
