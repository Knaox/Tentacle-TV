/**
 * Le retour automatique dans Ma liste écrit chez Jellyfin POUR LE COMPTE d'un
 * utilisateur : se tromper, c'est remettre une série que quelqu'un a retirée,
 * ou l'oublier pour de bon. Éprouvés : le tri des épisodes qui comptent, la
 * remise avec effacement et une seule diffusion, le refus de Jellyfin (ligne
 * gardée, silence), le réseau qui rejette, et la purge par lots.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  seriesId: string;
  jellyfinUserId: string;
  retiredAt: Date;
}
const rows: Row[] = [];
const broadcastToUser = vi.fn();
const pokeProfile = vi.fn();

vi.mock("./configStore", () => ({
  getJellyfinUrl: () => "http://jf.test",
  getJellyfinApiKey: () => "admin-key",
}));
vi.mock("./wsManager", () => ({
  broadcastToUser: (...args: unknown[]) => broadcastToUser(...args),
}));
vi.mock("./reco/jobs", () => ({
  pokeProfile: (...args: unknown[]) => pokeProfile(...args),
}));
vi.mock("./db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    watchlistAutoRetired: {
      findMany: async (args: { where: { seriesId: { in: string[] } } }) =>
        rows.filter((r) => args.where.seriesId.in.includes(r.seriesId)),
      deleteMany: async (args: {
        where: { seriesId: string | { in: string[] }; jellyfinUserId?: string };
      }) => {
        const { seriesId, jellyfinUserId } = args.where;
        const matches = (r: Row) =>
          (typeof seriesId === "string" ? r.seriesId === seriesId : seriesId.in.includes(r.seriesId)) &&
          (jellyfinUserId === undefined || r.jellyfinUserId === jellyfinUserId);
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i])) rows.splice(i, 1);
        return { count: before - rows.length };
      },
    },
  }),
}));

import type { LibItem } from "./jellyfin";
import { forgetRemovedSeries, restoreAutoRetiredSeries, seriesIdsToRestore } from "./watchlistAutoRetired";

function episode(season: number, number: number, seriesId = "s1"): LibItem {
  return {
    Id: `${seriesId}-${season}-${number}`,
    Name: `Épisode ${number}`,
    Type: "Episode",
    SeriesId: seriesId,
    ParentIndexNumber: season,
    IndexNumber: number,
  };
}

function row(seriesId: string, jellyfinUserId = "u1"): Row {
  return { seriesId, jellyfinUserId, retiredAt: new Date() };
}

describe("les séries à remettre", () => {
  it("retient la série d'un épisode de saison régulière, une seule fois", () => {
    expect(seriesIdsToRestore([episode(2, 1), episode(2, 2)])).toEqual(["s1"]);
  });

  it("ignore les spéciaux, les épisodes orphelins et tout ce qui n'est pas un épisode", () => {
    expect(seriesIdsToRestore([episode(0, 1)])).toEqual([]);
    expect(seriesIdsToRestore([{ ...episode(1, 1), ParentIndexNumber: undefined }])).toEqual([]);
    expect(seriesIdsToRestore([{ ...episode(1, 1), SeriesId: undefined }])).toEqual([]);
    expect(
      seriesIdsToRestore([
        { Id: "m", Name: "Film", Type: "Movie" },
        { Id: "s", Name: "Série", Type: "Series" },
        { Id: "se", Name: "Saison 2", Type: "Season", SeriesId: "s1", IndexNumber: 2 },
      ]),
    ).toEqual([]);
  });
});

describe("la remise dans Ma liste", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    rows.length = 0;
    fetchMock.mockReset();
    broadcastToUser.mockReset();
    pokeProfile.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("repose le like pour le compte de l'utilisateur, efface la ligne et prévient une seule fois", async () => {
    rows.push(row("s1"), row("s2"));
    fetchMock.mockResolvedValue({ ok: true });

    await restoreAutoRetiredSeries([episode(2, 1, "s1"), episode(3, 1, "s2")]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("http://jf.test/Users/u1/Items/s1/Rating?likes=true");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Emby-Token"]).toBe("admin-key");
    expect(rows).toHaveLength(0);
    expect(broadcastToUser).toHaveBeenCalledTimes(1);
    expect(broadcastToUser).toHaveBeenCalledWith("u1", "watchlist");
    expect(pokeProfile).toHaveBeenCalledTimes(1);
    expect(pokeProfile).toHaveBeenCalledWith("u1");
  });

  it("garde la ligne et se tait quand Jellyfin refuse", async () => {
    rows.push(row("s1"));
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await restoreAutoRetiredSeries([episode(2, 1)]);

    expect(rows).toHaveLength(1);
    expect(broadcastToUser).not.toHaveBeenCalled();
    expect(pokeProfile).not.toHaveBeenCalled();
  });

  it("ne fait rien sans ligne à remettre", async () => {
    await restoreAutoRetiredSeries([episode(2, 1)]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne lève jamais, même quand le réseau rejette", async () => {
    rows.push(row("s1"));
    fetchMock.mockRejectedValue(new Error("réseau"));

    await expect(restoreAutoRetiredSeries([episode(2, 1)])).resolves.toBeUndefined();
    expect(rows).toHaveLength(1);
  });

  it("oublie les suivis des séries disparues, par lots", async () => {
    rows.push(row("s1"), row("s9", "u2"));
    const removed = Array.from({ length: 1500 }, (_, i) => `x${i}`);
    removed.push("s1"); // au-delà du premier lot de 1000

    await forgetRemovedSeries(removed);

    expect(rows.map((r) => r.seriesId)).toEqual(["s9"]);
  });
});
