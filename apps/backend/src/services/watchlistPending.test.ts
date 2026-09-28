/**
 * « Ma liste à l'arrivée » écrit chez Jellyfin POUR LE COMPTE d'un
 * utilisateur : se tromper de cible, c'est mettre un autre titre dans sa
 * liste ; oublier d'effacer, c'est le remettre après qu'il l'a retiré.
 * Éprouvés : ce qu'une arrivée désigne (film, série, épisode → sa série),
 * la mise dans Ma liste avec effacement et une seule diffusion par compte,
 * le refus de Jellyfin (ligne gardée), et le balayage qui ne coûte rien
 * sans ligne.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  jellyfinUserId: string;
  mediaType: string;
  tmdbId: number;
  createdAt: Date;
}
const rows: Row[] = [];
const liked: Array<[string, string]> = [];
let jellyfinAccepts = true;
const broadcastToUser = vi.fn();
const pokeProfile = vi.fn();
const libraryTmdbIndex = vi.fn<() => Promise<Map<string, string> | null>>();

vi.mock("./jellyfinLikes", () => ({
  likeItemForUser: async (userId: string, itemId: string) => {
    if (!jellyfinAccepts) return false;
    liked.push([userId, itemId]);
    return true;
  },
}));
vi.mock("./jellyfinTmdbLookup", () => ({
  libraryTmdbIndex: () => libraryTmdbIndex(),
}));
vi.mock("./wsManager", () => ({
  broadcastToUser: (...args: unknown[]) => broadcastToUser(...args),
}));
vi.mock("./reco/jobs", () => ({
  pokeProfile: (...args: unknown[]) => pokeProfile(...args),
}));

type Where = { jellyfinUserId?: string; mediaType?: string; tmdbId?: number | { in: number[] } };
function matches(r: Row, w: Where): boolean {
  if (w.jellyfinUserId !== undefined && r.jellyfinUserId !== w.jellyfinUserId) return false;
  if (w.mediaType !== undefined && r.mediaType !== w.mediaType) return false;
  if (typeof w.tmdbId === "number" && r.tmdbId !== w.tmdbId) return false;
  if (typeof w.tmdbId === "object" && !w.tmdbId.in.includes(r.tmdbId)) return false;
  return true;
}

vi.mock("./db", () => ({
  hasPrisma: () => true,
  getPrisma: () => ({
    watchlistPending: {
      findMany: async (args: { where?: { OR?: Where[] }; skip?: number; take?: number }) => {
        const or = args.where?.OR;
        const found = rows.filter((r) => !or || or.some((w) => matches(r, w)));
        const skip = args.skip ?? 0;
        return found.slice(skip, args.take ? skip + args.take : undefined);
      },
      deleteMany: async (args: { where: Where }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], args.where)) rows.splice(i, 1);
        return { count: before - rows.length };
      },
    },
  }),
}));

import type { LibItem } from "./jellyfinLibrary";
import { applyPendingWatchlist, pendingTargetsOf, sweepPendingWatchlist } from "./watchlistPending";

function row(jellyfinUserId: string, mediaType: string, tmdbId: number): Row {
  return { jellyfinUserId, mediaType, tmdbId, createdAt: new Date() };
}
const movie = (id: string, tmdbId?: number): LibItem => ({ Id: id, Name: "Film", Type: "Movie", tmdbId });
const series = (id: string, tmdbId?: number): LibItem => ({ Id: id, Name: "Série", Type: "Series", tmdbId });
const episode = (id: string, seriesId: string, seriesTmdbId?: number): LibItem => ({
  Id: id, Name: "Épisode", Type: "Episode", SeriesId: seriesId, ParentIndexNumber: 1, IndexNumber: 1, seriesTmdbId,
});

beforeEach(() => {
  rows.length = 0;
  liked.length = 0;
  jellyfinAccepts = true;
  broadcastToUser.mockClear();
  pokeProfile.mockClear();
  libraryTmdbIndex.mockReset();
});

describe("ce qu'une arrivée désigne", () => {
  it("un film par son TMDB, une série par son item Series", () => {
    const targets = pendingTargetsOf([movie("m1", 603), series("s1", 1399)]);
    expect([...targets]).toEqual([["movie:603", "m1"], ["tv:1399", "s1"]]);
  });

  it("un épisode désigne SA série, et l'item Series du lot garde la main", () => {
    expect([...pendingTargetsOf([episode("e1", "s9", 1399)])]).toEqual([["tv:1399", "s9"]]);
    const both = pendingTargetsOf([series("s1", 1399), episode("e1", "s1", 1399)]);
    expect([...both]).toEqual([["tv:1399", "s1"]]);
  });

  it("ignore ce qui n'a pas de TMDB", () => {
    expect(pendingTargetsOf([movie("m1"), series("s1"), episode("e1", "s1")]).size).toBe(0);
  });
});

describe("l'arrivée d'un titre mis de côté", () => {
  it("le met dans Ma liste de chaque compte qui l'attendait, efface la ligne, prévient une fois", async () => {
    rows.push(row("u1", "movie", 603), row("u2", "movie", 603), row("u1", "tv", 1399), row("u3", "movie", 11));
    await applyPendingWatchlist([movie("m1", 603), episode("e1", "s1", 1399)]);
    expect(liked).toEqual([["u1", "m1"], ["u2", "m1"], ["u1", "s1"]]);
    expect(rows.map((r) => `${r.jellyfinUserId}:${r.mediaType}:${r.tmdbId}`)).toEqual(["u3:movie:11"]);
    expect(broadcastToUser.mock.calls).toEqual([["u1", "watchlist"], ["u2", "watchlist"]]);
    expect(pokeProfile).toHaveBeenCalledTimes(2);
  });

  it("garde la ligne quand Jellyfin refuse, sans rien diffuser", async () => {
    rows.push(row("u1", "movie", 603));
    jellyfinAccepts = false;
    await applyPendingWatchlist([movie("m1", 603)]);
    expect(rows).toHaveLength(1);
    expect(broadcastToUser).not.toHaveBeenCalled();
  });

  it("ne touche à rien pour un type qui ne correspond pas (un film n'est pas une série)", async () => {
    rows.push(row("u1", "tv", 603));
    await applyPendingWatchlist([movie("m1", 603)]);
    expect(liked).toEqual([]);
    expect(rows).toHaveLength(1);
  });
});

describe("le balayage", () => {
  it("ne liste pas la bibliothèque quand rien n'est mis de côté", async () => {
    expect(await sweepPendingWatchlist()).toBe(0);
    expect(libraryTmdbIndex).not.toHaveBeenCalled();
  });

  it("met dans Ma liste ce qui était déjà là, et laisse le reste attendre", async () => {
    rows.push(row("u1", "movie", 603), row("u1", "tv", 42));
    libraryTmdbIndex.mockResolvedValue(new Map([["movie:603", "m1"]]));
    expect(await sweepPendingWatchlist()).toBe(1);
    expect(liked).toEqual([["u1", "m1"]]);
    expect(rows.map((r) => `${r.mediaType}:${r.tmdbId}`)).toEqual(["tv:42"]);
  });

  it("n'efface rien quand Jellyfin est injoignable", async () => {
    rows.push(row("u1", "movie", 603));
    libraryTmdbIndex.mockResolvedValue(null);
    expect(await sweepPendingWatchlist()).toBe(0);
    expect(rows).toHaveLength(1);
  });
});
