/**
 * Ma liste n'est pas un goût. Un titre seulement listé — ni vu, ni suivi, ni
 * noté, ni aimé, ni refusé — ne pèse rien dans le profil : il est un
 * POTENTIEL. Éprouvés : la règle sur un vrai jeu d'ancres (Ma liste seule,
 * Ma liste + visionnage, Ma liste + note neutre trop faible pour une ancre),
 * « Ma liste à l'arrivée » d'un titre absent, les doublons, un titre sans
 * TMDB, et la lecture de la colonne stockée.
 */

import { describe, expect, it } from "vitest";
import { ANCHOR_COMPLETED } from "./anchorSignals";
import { parsePotentials, serializePotentials, POTENTIALS_MAX } from "./anchorStore";
import { buildAnchors } from "./anchors";
import type { AnchorInputs } from "./anchors";
import { potentialsOf } from "./potentials";
import type { SignalItem } from "./signals";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const movie = (id: string, tmdb: number, over: Partial<SignalItem> = {}): SignalItem => ({
  Id: id, Name: `Film ${id}`, Type: "Movie", ProviderIds: { Tmdb: String(tmdb) }, RunTimeTicks: 72_000_000_000, ...over,
});

function inputs(over: Partial<AnchorInputs> = {}): AnchorInputs {
  return {
    now: NOW, ratings: [], likes: [], feedback: [], favorites: [], playedMovies: [],
    resumable: [], playedEpisodes: [], seriesById: new Map(), ...over,
  };
}

describe("Ma liste → potentiels", () => {
  it("un titre seulement dans Ma liste n'est pas une ancre : c'est un potentiel", () => {
    const listed = movie("m1", 603);
    const set = buildAnchors(inputs());
    expect(set.anchors).toEqual([]);
    expect(potentialsOf(set, [listed])).toEqual([
      { key: "movie:603", mediaType: "movie", tmdbId: 603, title: "Film m1", jellyfinId: "m1" },
    ]);
  });

  it("vu, il est jugé : ancre du seul visionnage (Ma liste n'y ajoute rien), plus de potentiel", () => {
    const seen = movie("m1", 603, { UserData: { Played: true, LastPlayedDate: iso(2) } });
    const set = buildAnchors(inputs({ playedMovies: [seen] }));
    expect(set.anchors[0].weight).toBeCloseTo(ANCHOR_COMPLETED, 2);
    expect(set.anchors[0].kinds).toEqual(["completed"]);
    expect(potentialsOf(set, [seen])).toEqual([]);
  });

  it("une note neutre (trop faible pour une ancre) le juge quand même", () => {
    const set = buildAnchors(inputs({
      // Deux notes : la moyenne et l'écart font de 6,5 le point neutre.
      ratings: [
        { mediaType: "movie", tmdbId: 603, score: 6.5, updatedAt: iso(1) },
        { mediaType: "movie", tmdbId: 11, score: 9, updatedAt: iso(1) },
      ],
    }));
    expect(set.anchors.some((a) => a.key === "movie:603")).toBe(false);
    expect(set.judged.has("movie:603")).toBe(true);
    expect(potentialsOf(set, [movie("m1", 603)])).toEqual([]);
  });

  it("un refus, un like d'Affiner, « ne plus me proposer » le jugent aussi ; « passer » non", () => {
    const set = buildAnchors(inputs({
      swipes: [
        { mediaType: "movie", tmdbId: 1, verdict: "dislike", updatedAt: iso(1) },
        { mediaType: "movie", tmdbId: 2, verdict: "like", updatedAt: iso(1) },
        { mediaType: "movie", tmdbId: 4, verdict: "skip", updatedAt: iso(1) },
      ],
      feedback: [{ itemKey: "movie:3", action: "dismissed", createdAt: iso(1) }],
    }));
    const listed = [movie("a", 1), movie("b", 2), movie("c", 3), movie("d", 4)];
    expect(potentialsOf(set, listed).map((p) => p.key)).toEqual(["movie:4"]);
  });

  it("« Ma liste à l'arrivée » d'un titre absent est un potentiel, sans item ni titre", () => {
    const set = buildAnchors(inputs({ swipes: [{ mediaType: "tv", tmdbId: 7, verdict: "superlike", updatedAt: iso(1) }] }));
    const pending = [{ mediaType: "tv", tmdbId: 1399 }, { mediaType: "tv", tmdbId: 7 }, { mediaType: "movie", tmdbId: 603 }];
    expect(potentialsOf(set, [movie("m1", 603)], pending)).toEqual([
      { key: "movie:603", mediaType: "movie", tmdbId: 603, title: "Film m1", jellyfinId: "m1" },
      { key: "tv:1399", mediaType: "tv", tmdbId: 1399, title: "", jellyfinId: null },
    ]);
  });

  it("un titre sans TMDB garde sa clé Jellyfin", () => {
    const anime: SignalItem = { Id: "x1", Name: "Animé AniDB", Type: "Series", ProviderIds: { AniDB: "5" } };
    expect(potentialsOf(buildAnchors(inputs()), [anime])).toEqual([
      { key: "jf:x1", mediaType: "tv", tmdbId: 0, title: "Animé AniDB", jellyfinId: "x1" },
    ]);
  });
});

describe("colonne taste_profiles.potentials", () => {
  it("se relit telle qu'écrite, bornée ; illisible ou absente → null", () => {
    const many = Array.from({ length: POTENTIALS_MAX + 5 }, (_, i) => ({
      key: `movie:${i + 1}`, mediaType: "movie" as const, tmdbId: i + 1, title: "", jellyfinId: null,
    }));
    const read = parsePotentials(serializePotentials(many));
    expect(read).toHaveLength(POTENTIALS_MAX);
    expect(read![0]).toEqual(many[0]);
    expect(parsePotentials(null)).toBeNull();
    expect(parsePotentials("{pas du json")).toBeNull();
    expect(parsePotentials(JSON.stringify([{ key: "movie:1", mediaType: "book" }, { nope: 1 }]))).toEqual([]);
  });
});
