/**
 * Les voisins de saison : l'URL `adjacentTo`, les filtres qui écartent les
 * faux témoins, et la distinction « Jellyfin muet » / « personne ».
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "admin-key",
  getConfigValue: (key: string) => (key === "admin_jellyfin_id" ? "admin-user-id" : undefined),
}));

import type { EpisodeContext } from "./jellyfinSegments";
import {
  fetchEpisodeNeighbours,
  neighbourKey,
  neighboursUrl,
  pickNeighbours,
} from "./episodeNeighbours";

const EPISODE: EpisodeContext = {
  seriesId: "series-1",
  seasonId: "season-4",
  seasonNumber: 4,
  indexNumber: 3,
  sourceBitrate: null,
  createdAt: null,
};

const dto = (index: number, over: Record<string, unknown> = {}) => ({
  Id: `ep-${index}`,
  Type: "Episode",
  ParentIndexNumber: 4,
  IndexNumber: index,
  RunTimeTicks: 14_200_000_000,
  MediaSources: [{ Id: `src-${index}`, Bitrate: 8_000_000 }],
  ...over,
});

describe("neighboursUrl", () => {
  it("adjacentTo, saison, userId admin, sans les épisodes manquants, avec les sources", () => {
    expect(neighboursUrl("http://jf.test", EPISODE, "ep-3")).toBe(
      "http://jf.test/Shows/series-1/Episodes?seasonId=season-4&adjacentTo=ep-3" +
        "&userId=admin-user-id&isMissing=false&fields=MediaSources",
    );
  });
});

describe("pickNeighbours", () => {
  it("garde le précédent et le suivant, écarte l'épisode lui-même", () => {
    const picked = pickNeighbours([dto(2), dto(3), dto(4)], EPISODE, "ep-3");
    expect(picked.map((n) => n.id)).toEqual(["ep-2", "ep-4"]);
    expect(picked[0]).toEqual({
      id: "ep-2", indexNumber: 2, runtimeMs: 1_420_000, mediaSourceId: "src-2", sourceBitrate: 8_000_000,
    });
  });

  it("écarte les faux témoins : autre saison, doublon de numéro, virtuel, trop loin, sans fichier, sans durée", () => {
    const picked = pickNeighbours(
      [
        dto(2, { ParentIndexNumber: 3 }),
        dto(3, { Id: "ep-3-bis" }),
        dto(4, { LocationType: "Virtual" }),
        dto(6),
        dto(1, { MediaSources: [] }),
        dto(5, { RunTimeTicks: 0 }),
        dto(2, { Id: "ep 2", ParentIndexNumber: 4 }),
        { Id: "ep-4b", Type: "Season", IndexNumber: 4 },
      ],
      EPISODE,
      "ep-3",
    );
    expect(picked).toEqual([]);
  });

  it("en bord de saison, prend les deux du même côté, les plus proches d'abord", () => {
    const first = { ...EPISODE, indexNumber: 1 };
    const picked = pickNeighbours([dto(1), dto(2), dto(3)], first, "ep-1");
    expect(picked.map((n) => n.id)).toEqual(["ep-2", "ep-3"]);
  });

  it("sans numéro d'épisode connu, prend simplement les deux premiers voisins valides", () => {
    const unknown = { ...EPISODE, indexNumber: null, seasonNumber: null };
    const picked = pickNeighbours([dto(7), dto(8), dto(9)], unknown, "ep-8");
    expect(picked.map((n) => n.id)).toEqual(["ep-7", "ep-9"]);
  });

  it("le débit absent vaut null", () => {
    const picked = pickNeighbours([dto(2, { MediaSources: [{ Id: "src-2" }] })], EPISODE, "ep-3");
    expect(picked[0].sourceBitrate).toBeNull();
  });
});

describe("neighbourKey", () => {
  it("trie les identifiants — la même saison donne la même clé", () => {
    const a = pickNeighbours([dto(2), dto(4)], EPISODE, "ep-3");
    const b = pickNeighbours([dto(4), dto(2)], EPISODE, "ep-3");
    expect(neighbourKey(a)).toBe("ep-2,ep-4");
    expect(neighbourKey(b)).toBe("ep-2,ep-4");
    expect(neighbourKey([])).toBe("");
  });
});

describe("fetchEpisodeNeighbours", () => {
  let scenario: Array<[RegExp, { status?: number; json?: unknown } | "reject"]> = [];

  beforeEach(() => {
    scenario = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        for (const [pattern, response] of scenario) {
          if (!pattern.test(url)) continue;
          if (response === "reject") throw new Error("réseau coupé");
          return new Response(JSON.stringify(response.json ?? null), {
            status: response.status ?? 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response("{}", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Jellyfin muet, ou une réponse sans Items, vaut null — transitoire", async () => {
    scenario = [[/./, "reject"]];
    expect(await fetchEpisodeNeighbours("http://jf.test", "k", EPISODE, "ep-3")).toBeNull();
    scenario = [[/./, { json: { TotalRecordCount: 0 } }]];
    expect(await fetchEpisodeNeighbours("http://jf.test", "k", EPISODE, "ep-3")).toBeNull();
    scenario = [[/./, { status: 500 }]];
    expect(await fetchEpisodeNeighbours("http://jf.test", "k", EPISODE, "ep-3")).toBeNull();
  });

  it("une liste vide, ou sans voisin valide, vaut [] — il n'y a personne", async () => {
    scenario = [[/adjacentTo=ep-3/, { json: { Items: [dto(3)] } }]];
    expect(await fetchEpisodeNeighbours("http://jf.test", "k", EPISODE, "ep-3")).toEqual([]);
  });

  it("rend les voisins filtrés", async () => {
    scenario = [[/adjacentTo=ep-3/, { json: { Items: [dto(2), dto(3), dto(4)] } }]];
    const got = await fetchEpisodeNeighbours("http://jf.test", "k", EPISODE, "ep-3");
    expect(got?.map((n) => n.id)).toEqual(["ep-2", "ep-4"]);
  });
});
