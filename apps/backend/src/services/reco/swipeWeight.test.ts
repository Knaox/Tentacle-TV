import { describe, expect, it } from "vitest";
import {
  ANCHOR_FAVORITE,
  ANCHOR_SWIPE_DISLIKE,
  ANCHOR_SWIPE_LIKE,
  ANCHOR_SWIPE_SUPERLIKE,
  explicitDecay,
} from "./anchorSignals";
import { buildAnchors } from "./anchors";
import type { Anchor, AnchorInputs } from "./anchors";
import type { FacetEntry } from "./facets";
import { pickSeeds } from "./seedPicker";
import { DEFAULT_TASTE_WEIGHTS, TasteScoringStrategy } from "./scoring/tasteStrategy";
import type { Candidate, TasteVector } from "./scoring/strategy";
import { buildCentroid, buildTasteIndex } from "./tasteModel";

/**
 * Le poids RÉEL des verdicts de l'onglet « Affiner » dans le moteur : de la
 * table user_swipes jusqu'au score d'un candidat, par les vraies fonctions
 * (ancres → index → classement), sans rien simuler du calcul.
 */

const NOW = Date.parse("2026-09-27T12:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const idf = () => 1;
const f = (...keys: string[]): FacetEntry[] => keys.map((key) => ({ key, mult: 1 }));

type Swipe = NonNullable<AnchorInputs["swipes"]>[number];
const swipe = (tmdbId: number, verdict: string, daysAgo = 0): Swipe => ({
  mediaType: "movie",
  tmdbId,
  verdict,
  updatedAt: iso(daysAgo),
});

function anchorsOf(swipes: Swipe[]): Anchor[] {
  return buildAnchors({
    now: NOW,
    ratings: [],
    likes: [],
    feedback: [],
    swipes,
    favorites: [],
    playedMovies: [],
    resumable: [],
    playedEpisodes: [],
    seriesById: new Map(),
  }).anchors;
}

// Trois univers bien séparés : le titre jugé et deux voisins proches chacun.
const FACETS: Record<string, FacetEntry[]> = {
  "movie:1": f("genre:878", "kw:space", "kw:alien", "director:1"), // super like
  "movie:2": f("genre:35", "kw:romcom", "kw:wedding", "director:2"), // like
  "movie:3": f("genre:27", "kw:slasher", "kw:gore", "director:3"), // dislike
  "movie:4": f("genre:99", "kw:nature", "kw:ocean", "director:4"), // repère aimé, loin de tout
};
const facetsOf = (a: Anchor) => FACETS[a.key] ?? null;

function candidate(key: string, facets: FacetEntry[]): Candidate {
  return {
    key,
    mediaType: "movie",
    tmdbId: Number(key.split(":")[1]),
    title: key,
    year: 2015,
    facets,
    voteAverage: 7.5,
    voteCount: 5000,
    popularity: 20,
    source: "tmdb_rec",
  };
}

// Même degré de ressemblance (3 facettes sur 4) avec chaque titre jugé.
const NEAR_SUPER = candidate("movie:101", f("genre:878", "kw:space", "kw:alien", "kw:other1"));
const NEAR_LIKE = candidate("movie:102", f("genre:35", "kw:romcom", "kw:wedding", "kw:other2"));
const NEAR_DISLIKE = candidate("movie:103", f("genre:27", "kw:slasher", "kw:gore", "kw:other3"));
// Ne partage que le GENRE du titre refusé : cousin éloigné.
const GENRE_OF_DISLIKE = candidate("movie:104", f("genre:27", "kw:ghost", "kw:house", "kw:other4"));
const NEUTRAL = candidate("movie:105", f("genre:10402", "kw:band", "kw:tour", "kw:other5"));
const BASKET = [NEAR_SUPER, NEAR_LIKE, NEAR_DISLIKE, GENRE_OF_DISLIKE, NEUTRAL];

function strategyFor(swipes: Swipe[]) {
  const anchors = anchorsOf(swipes);
  const index = buildTasteIndex(anchors, facetsOf, idf);
  const shares = { movie: 1, tv: 0 };
  const profile: TasteVector = { facets: buildCentroid(anchors, facetsOf, idf, shares), signalCount: anchors.length };
  const strategy = new TasteScoringStrategy({ index, idfFor: idf, nowYear: 2026, recencyAffinity: 0 });
  strategy.calibrate(profile, BASKET);
  return (c: Candidate) => strategy.score(profile, c).total;
}

const ALL = [swipe(1, "superlike"), swipe(2, "like"), swipe(3, "dislike"), swipe(4, "like")];

describe("verdicts du swipe → ancres", () => {
  it("super like > favori > like > 0 > dislike ; « passé » ne crée aucune ancre", () => {
    expect(ANCHOR_SWIPE_SUPERLIKE).toBeGreaterThan(ANCHOR_FAVORITE);
    expect(ANCHOR_FAVORITE).toBeGreaterThan(ANCHOR_SWIPE_LIKE);
    const byKey = new Map(anchorsOf([...ALL, swipe(9, "skip")]).map((a) => [a.key, a]));
    expect(byKey.get("movie:1")!.weight).toBeCloseTo(ANCHOR_SWIPE_SUPERLIKE, 10);
    expect(byKey.get("movie:2")!.weight).toBeCloseTo(ANCHOR_SWIPE_LIKE, 10);
    expect(byKey.get("movie:3")!.weight).toBeCloseTo(ANCHOR_SWIPE_DISLIKE, 10);
    expect(byKey.has("movie:9")).toBe(false);
    expect(byKey.get("movie:1")!.kinds).toEqual(["superlike"]);
    expect(byKey.get("movie:3")!.kinds).toEqual(["swipe_dislike"]);
    // Un goût déclaré ne vaut pas visionnage : la part films/séries l'ignore.
    expect(byKey.get("movie:1")!.consumption).toBe(false);
  });

  it("un like d'Affiner qui a posé le cœur ne compte pas deux fois : le plus fort des deux", () => {
    const withHeart = (verdict: string) =>
      buildAnchors({
        now: NOW, ratings: [], likes: [], feedback: [], swipes: [swipe(1, verdict)],
        favorites: [{ Id: "m1", Name: "Film", Type: "Movie", ProviderIds: { Tmdb: "1" } }],
        playedMovies: [], resumable: [], playedEpisodes: [], seriesById: new Map(),
      }).anchors[0];
    const liked = withHeart("like");
    expect(liked.weight).toBeCloseTo(ANCHOR_FAVORITE, 10);
    expect(liked.kinds.sort()).toEqual(["favorite", "swipe_like"]);
    expect(withHeart("superlike").weight).toBeCloseTo(ANCHOR_SWIPE_SUPERLIKE, 10);
    // Un refus reste un refus : il ne se fond pas dans le cœur, il le contredit.
    expect(withHeart("dislike").weight).toBeCloseTo(ANCHOR_FAVORITE + ANCHOR_SWIPE_DISLIKE, 10);
  });

  it("un vieux verdict pèse moins, sans jamais s'effacer (décroissance explicite)", () => {
    const [old] = anchorsOf([swipe(1, "superlike", 1460)]);
    expect(old.weight).toBeCloseTo(ANCHOR_SWIPE_SUPERLIKE * explicitDecay(1460), 10);
    expect(old.weight).toBeGreaterThan(ANCHOR_SWIPE_LIKE * 0.99);
  });

  it("un super like fait une graine plus forte qu'un like ; un dislike n'en fait jamais", () => {
    const seeds = pickSeeds(anchorsOf(ALL), facetsOf, { shares: { movie: 1, tv: 0 }, now: NOW });
    const keys = seeds.map((s) => `movie:${s.tmdbId}`);
    expect(keys[0]).toBe("movie:1");
    expect(keys).toContain("movie:2");
    expect(keys).not.toContain("movie:3");
  });

  it("le profil moyen retire les facettes du titre refusé", () => {
    const anchors = anchorsOf(ALL);
    const centroid = buildCentroid(anchors, facetsOf, idf, { movie: 1, tv: 0 });
    expect(centroid["kw:slasher"]).toBeLessThan(0);
    expect(centroid["kw:space"]).toBeGreaterThan(centroid["kw:romcom"]);
  });
});

describe("verdicts du swipe → classement", () => {
  const score = strategyFor(ALL);

  it("voisin d'un super like > voisin d'un like > neutre > voisin d'un dislike", () => {
    expect(score(NEAR_SUPER)).toBeGreaterThan(score(NEAR_LIKE));
    expect(score(NEAR_LIKE)).toBeGreaterThan(score(NEUTRAL));
    expect(score(NEUTRAL)).toBeGreaterThan(score(NEAR_DISLIKE));
  });

  it("le dislike pénalise ses voisins AVEC MESURE : borné, et proportionné à la ressemblance", () => {
    const without = strategyFor(ALL.filter((s) => s.verdict !== "dislike"));
    const nearPenalty = without(NEAR_DISLIKE) - score(NEAR_DISLIKE);
    const genrePenalty = without(GENRE_OF_DISLIKE) - score(GENRE_OF_DISLIKE);
    expect(nearPenalty).toBeGreaterThan(0.05);
    // Jamais plus que la composante « ressemblance aux refus » elle-même.
    expect(nearPenalty).toBeLessThanOrEqual(DEFAULT_TASTE_WEIGHTS.negative + 1e-9);
    // Partager un genre coûte moins que ressembler vraiment.
    expect(genrePenalty).toBeGreaterThanOrEqual(0);
    expect(genrePenalty).toBeLessThan(nearPenalty);
  });

  it("sans verdict, les voisins du super like n'ont aucun avantage : c'est bien le swipe qui pèse", () => {
    const blank = strategyFor([swipe(4, "like")]);
    expect(blank(NEAR_SUPER)).toBeCloseTo(blank(NEAR_LIKE), 6);
    expect(score(NEAR_SUPER) - blank(NEAR_SUPER)).toBeGreaterThan(0.1);
  });
});
