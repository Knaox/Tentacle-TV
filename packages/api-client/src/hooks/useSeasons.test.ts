import { describe, expect, it, vi } from "vitest";
import { getSeasonEpisodesLiteKey, prefetchSeasonEpisodesLite, prefetchSeasons } from "./useSeasons";

/** Un QueryClient réduit à `prefetchQuery`, qui exécute la requête préchargée. */
function prefetcher() {
  const calls: Array<Record<string, unknown>> = [];
  const qc = {
    prefetchQuery: vi.fn(async (options: Record<string, unknown>) => {
      calls.push(options);
      await (options.queryFn as () => Promise<unknown>)();
    }),
  };
  return { qc, calls };
}

describe("épisodes légers d'une saison", () => {
  it("la clé prolonge celle de useEpisodes : les invalidations par préfixe la couvrent", () => {
    expect(getSeasonEpisodesLiteKey("serie", "saison").slice(0, 3)).toEqual(["episodes", "serie", "saison"]);
  });

  it("précharge sous la clé du hook, sans demander les sources", async () => {
    const fetch = vi.fn().mockResolvedValue({ Items: [] });
    const { qc, calls } = prefetcher();
    await prefetchSeasonEpisodesLite(qc, { fetch }, "user", "serie", "saison");
    expect(calls[0].queryKey).toEqual(["episodes", "serie", "saison", "lite"]);
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain("SeasonId=saison");
    expect(url).toContain("EnableUserData=true");
    expect(url).not.toMatch(/MediaSources|MediaStreams/);
  });

  it("ne précharge rien sans utilisateur", async () => {
    const fetch = vi.fn();
    const { qc } = prefetcher();
    await prefetchSeasonEpisodesLite(qc, { fetch }, null, "serie", "saison");
    await prefetchSeasons(qc, { fetch }, undefined, "serie");
    expect(qc.prefetchQuery).not.toHaveBeenCalled();
  });

  it("les saisons se préchargent sous la clé de useSeasons", async () => {
    const fetch = vi.fn().mockResolvedValue({ Items: [] });
    const { qc, calls } = prefetcher();
    await prefetchSeasons(qc, { fetch }, "user", "serie");
    expect(calls[0].queryKey).toEqual(["seasons", "serie"]);
  });
});
