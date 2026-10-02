import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TitleProvider } from "@tentacle-tv/shared";
import { loadTitleGaps } from "./useTitleGaps";

const provider: TitleProvider = {
  pluginId: "seer", statePath: "/titles/state", requestPath: "/titles/request", accessPath: null, minePath: null,
  seasonsPath: "/titles/seasons", gapsPath: "/titles/gaps",
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("le regroupement des saisons manquantes", () => {
  it("pose UNE question pour toutes les séries d'une page ; une série sans trou n'a rien", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe("/api/plugins/seer/titles/gaps?keys=tv%3A1399%2Ctv%3A1396&lang=fr");
      return { items: { "tv:1399": { seasons: [{ number: 8, name: "Saison 8", episodeCount: 6, badge: null, requestable: true }] } } };
    });
    const a = loadTitleGaps(provider, "tv:1399", "fr", fetcher);
    const b = loadTitleGaps(provider, "tv:1396", "fr", fetcher);
    await vi.advanceTimersByTimeAsync(20);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await a).map((s) => s.number)).toEqual([8]);
    expect(await b).toEqual([]);
  });

  it("une extension qui ne déclare pas la route : rien demandé, rien offert", async () => {
    const fetcher = vi.fn(async () => ({ items: {} }));
    const old = loadTitleGaps({ ...provider, gapsPath: null }, "tv:1399", "fr", fetcher);
    await vi.advanceTimersByTimeAsync(20);
    expect(await old).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fait échouer les séries du paquet quand le plugin ne répond pas", async () => {
    const fetcher = vi.fn(async () => { throw new Error("503"); });
    const settled = loadTitleGaps(provider, "tv:1399", "en", fetcher).catch((err: Error) => err.message);
    await vi.advanceTimersByTimeAsync(20);
    expect(await settled).toBe("503");
  });
});
