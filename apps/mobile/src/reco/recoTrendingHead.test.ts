/**
 * « Tendances actuelles » sur le mobile : l'app ACCEPTE la tête dès le chargement
 * du module racine ; face à un serveur qui ne déclare pas `reco.trending`, rien
 * ne change — même requête, même clé de cache, rangée `trending` gardée, sans erreur.
 */
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  RECO_SETTINGS_KEY, appConfigQuery, forYouPageRows, getRecoPageKey, trendingHeadFromCache,
} from "@tentacle-tv/api-client";
import "./recoTrendingHead";

const SETTINGS = {
  personalized: true, includeVigie: true, community: true, shareHistory: true, explorationBalance: 70, providerFilter: [],
};

function cacheWith(config: Record<string, unknown>) {
  const qc = new QueryClient();
  qc.setQueryData(appConfigQuery().queryKey, { brandName: "Tentacle", ...config });
  qc.setQueryData(RECO_SETTINGS_KEY, SETTINGS);
  return qc;
}

describe("tête des tendances sur le mobile", () => {
  it("serveur qui ne déclare pas reco.trending : rien, la page d'avant", () => {
    const head = trendingHeadFromCache(cacheWith({ version: "1.30.0" }));
    expect(head).toEqual({ ready: true, trendingNow: false });
    expect(getRecoPageKey([], head.trendingNow)).toEqual(getRecoPageKey([]));
    const rows = [{ key: "forYou" }, { key: "trending" }];
    expect(forYouPageRows(rows)).toEqual(rows);
  });

  it("serveur qui la déclare : l'app la demande, sous sa clé à part", () => {
    const head = trendingHeadFromCache(cacheWith({ version: "1.31.0", capabilities: ["reco.trending"] }));
    expect(head).toEqual({ ready: true, trendingNow: true });
    expect(getRecoPageKey([], true)).toEqual([...getRecoPageKey([]), "trendingNow"]);
    expect(forYouPageRows([{ key: "trendingNow" }, { key: "trending" }, { key: "forYou" }]).map((r) => r.key))
      .toEqual(["trendingNow", "forYou"]);
  });
});
