/**
 * La reconnaissance des contenus : un fichier remplacé (mise à niveau,
 * déplacement) ou une seconde version n'est pas une nouveauté ; un contenu
 * parti depuis plus de 24 h qui revient en est une ; un item sans identité
 * n'est jamais étouffé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  itemId: string;
  contentKey: string | null;
  removedAt: Date | null;
}
const rows: Row[] = [];

vi.mock("./db", () => ({
  getPrisma: () => ({
    libraryKnownId: {
      findMany: async (args: { where: { contentKey?: { in: string[] }; removedAt?: null } }) =>
        rows.filter((r) => {
          if (args.where.contentKey && !(r.contentKey && args.where.contentKey.in.includes(r.contentKey))) return false;
          if (args.where.removedAt === null && r.removedAt !== null) return false;
          return true;
        }),
    },
  }),
}));

import type { LibItem } from "./jellyfinLibrary";
import { REPLACEMENT_GRACE_MS, classifyArrivals, loadPresentIds, presenceKey } from "./libraryPresence";

const NOW = Date.UTC(2026, 8, 24, 12);
const HOUR = 60 * 60_000;
const movie = (id: string, tmdbId?: number, name = "Dune", year?: number): LibItem => ({
  Id: id,
  Name: name,
  Type: "Movie",
  tmdbId,
  ProductionYear: year,
});
const episode = (id: string, s: number | undefined, e: number | undefined, seriesTmdbId = 136315): LibItem => ({
  Id: id,
  Name: "Pilot",
  Type: "Episode",
  SeriesName: "The Bear",
  SeriesId: "series-bear",
  seriesTmdbId,
  ParentIndexNumber: s,
  IndexNumber: e,
});

beforeEach(() => {
  rows.length = 0;
});

describe("clé de contenu", () => {
  it("film : TMDB, à défaut nom + année (deux homonymes restent deux contenus)", () => {
    expect(presenceKey(movie("a", 438631))).toBe("m:t:438631");
    expect(presenceKey(movie("a", undefined, "Dune", 1984))).toBe("m:n:dune:1984");
    expect(presenceKey(movie("b", undefined, "Dune", 2021))).not.toBe(presenceKey(movie("a", undefined, "Dune", 1984)));
  });

  it("épisode : TMDB de la série + numéros, à défaut l'ID Jellyfin de la série — jamais le nom", () => {
    expect(presenceKey(episode("e", 1, 2))).toBe("e:t:136315:1:2");
    expect(presenceKey({ ...episode("e", 1, 2), seriesTmdbId: undefined })).toBe("e:i:series-bear:1:2");
  });

  it("deux séries homonymes (l'animé et la série live) ne partagent pas de clé", () => {
    const anime = { ...episode("a", 1, 1, 37854), SeriesName: "One Piece", SeriesId: "op-anime" };
    const live = { ...episode("b", 1, 1, 111110), SeriesName: "One Piece", SeriesId: "op-live" };
    expect(presenceKey(anime)).not.toBe(presenceKey(live));
  });

  it("série, saison ou épisode sans numéros : pas de clé", () => {
    expect(presenceKey({ Id: "s", Name: "The Bear", Type: "Series" })).toBe("");
    expect(presenceKey(episode("e", undefined, 3))).toBe("");
  });
});

describe("tri des arrivées", () => {
  it("un contenu jamais vu est une nouveauté", async () => {
    const v = await classifyArrivals([movie("new", 1)], NOW);
    expect(v.news.map((i) => i.Id)).toEqual(["new"]);
    expect(v.known).toEqual([]);
  });

  it("une seconde version d'un film encore là n'en est pas une", async () => {
    rows.push({ itemId: "old", contentKey: "m:t:1", removedAt: null });
    const v = await classifyArrivals([movie("new", 1)], NOW);
    expect(v.known.map((i) => i.Id)).toEqual(["new"]);
  });

  it("un fichier remplacé (parti il y a moins de 24 h) n'en est pas une", async () => {
    rows.push({ itemId: "old", contentKey: "e:t:136315:1:2", removedAt: new Date(NOW - 2 * HOUR) });
    const v = await classifyArrivals([episode("new", 1, 2)], NOW);
    expect(v.known.map((i) => i.Id)).toEqual(["new"]);
  });

  it("l'ancien fichier enregistré sous une clé plus faible est reconnu quand même", async () => {
    rows.push({ itemId: "old", contentKey: "e:i:series-bear:1:2", removedAt: new Date(NOW - HOUR) });
    const v = await classifyArrivals([episode("new", 1, 2)], NOW);
    expect(v.known.map((i) => i.Id)).toEqual(["new"]);
  });

  it("le nouvel épisode d'une série homonyme reste une nouveauté", async () => {
    rows.push({ itemId: "anime", contentKey: "e:t:37854:2:1", removedAt: null });
    const live = { ...episode("live", 2, 1, 111110), SeriesName: "One Piece", SeriesId: "op-live" };
    const v = await classifyArrivals([live], NOW);
    expect(v.news.map((i) => i.Id)).toEqual(["live"]);
  });

  it("un contenu parti depuis plus de 24 h qui revient en redevient une", async () => {
    rows.push({ itemId: "old", contentKey: "m:t:1", removedAt: new Date(NOW - REPLACEMENT_GRACE_MS - 1) });
    const v = await classifyArrivals([movie("new", 1)], NOW);
    expect(v.news.map((i) => i.Id)).toEqual(["new"]);
  });

  it("un item sans identité n'est jamais étouffé", async () => {
    rows.push({ itemId: "x", contentKey: "", removedAt: null });
    const v = await classifyArrivals([episode("new", undefined, 1)], NOW);
    expect(v.news.map((i) => i.Id)).toEqual(["new"]);
  });

  it("un lot mêlé est trié item par item", async () => {
    rows.push({ itemId: "old", contentKey: "m:t:1", removedAt: null });
    const v = await classifyArrivals([movie("dup", 1), movie("fresh", 2), episode("ep", 1, 1)], NOW);
    expect(v.known.map((i) => i.Id)).toEqual(["dup"]);
    expect(v.news.map((i) => i.Id)).toEqual(["fresh", "ep"]);
  });
});

describe("instantané", () => {
  it("les IDs présents excluent les départs", async () => {
    rows.push({ itemId: "here", contentKey: "m:t:1", removedAt: null });
    rows.push({ itemId: "gone", contentKey: "m:t:2", removedAt: new Date(NOW) });
    expect([...(await loadPresentIds())]).toEqual(["here"]);
  });
});
