import { describe, expect, it } from "vitest";
import { latestCardIds, planLatestCards, type LatestCard, type ScannedAddition } from "./latestGrouping";

/**
 * Un inventaire écrit du plus ancien au plus récent (l'ordre où l'on raconte
 * une bibliothèque qui se remplit), rendu comme Jellyfin le rend : du plus
 * récent au plus ancien, une minute entre deux ajouts.
 */
function inventory(...oldestFirst: ScannedAddition[]): ScannedAddition[] {
  const start = Date.parse("2026-10-01T08:00:00Z");
  return oldestFirst
    .map((a, i) => ({ ...a, DateCreated: new Date(start + i * 60_000).toISOString() }))
    .reverse();
}

const movie = (id: string): ScannedAddition => ({ Id: id, Type: "Movie" });
const series = (id: string): ScannedAddition => ({ Id: id, Type: "Series" });
const season = (seriesId: string, n: number): ScannedAddition => ({
  Id: `${seriesId}-s${n}`, Type: "Season", SeriesId: seriesId, IndexNumber: n,
});
const episode = (seriesId: string, s: number, e: number): ScannedAddition => ({
  Id: `${seriesId}-s${s}e${e}`, Type: "Episode", SeriesId: seriesId, SeasonId: `${seriesId}-s${s}`,
  ParentIndexNumber: s, IndexNumber: e,
});
/**
 * Une saison entière : ses épisodes, puis son dossier — Jellyfin date un
 * dossier à sa découverte par le scan, APRÈS ses fichiers (mesuré, 12.1).
 */
const fullSeason = (seriesId: string, n: number, count: number): ScannedAddition[] =>
  [...Array.from({ length: count }, (_, i) => episode(seriesId, n, i + 1)), season(seriesId, n)];

/** La rangée en une ligne lisible : « A:3e », « m1 », « B:S » (nouvelle saison)… */
function summary(cards: LatestCard[]): string[] {
  return cards.map((card) => {
    if (card.kind === "item") return card.id;
    const a = card.additions;
    const flags = [a.NewSeries ? "N" : "", a.NewSeasonNumbers.length > 0 ? `S${a.NewSeasonNumbers.join("+")}` : ""].join("");
    return `${card.seriesId}:${a.EpisodeCount}e${flags ? `:${flags}` : ""}`;
  });
}

describe("planLatestCards — une série, une carte", () => {
  it("les épisodes d'une même série, mêlés à d'autres ajouts, ne forment qu'une carte à la place du plus récent", () => {
    const plan = planLatestCards(inventory(
      episode("A", 1, 1), episode("B", 1, 1), movie("m1"), episode("A", 1, 2),
      episode("B", 1, 2), episode("C", 2, 4), episode("A", 1, 3),
    ), 16);
    expect(summary(plan)).toEqual(["A:3e", "C-s2e4", "B:2e", "m1"]);
  });

  it("plusieurs séries mêlées : chacune une seule fois, dans l'ordre de son dernier ajout", () => {
    const plan = planLatestCards(inventory(
      episode("X", 1, 7), episode("Y", 3, 1), episode("Z", 1, 1), episode("Y", 3, 2),
      episode("X", 1, 8), episode("W", 2, 5), episode("Y", 3, 3), episode("Z", 1, 2),
    ), 16);
    expect(summary(plan)).toEqual(["Z:2e", "Y:3e", "W-s2e5", "X:2e"]);
    expect(new Set(latestCardIds(plan)).size).toBe(plan.length);
  });

  it("un épisode seul reste l'épisode — rien à regrouper", () => {
    expect(planLatestCards(inventory(episode("A", 2, 5), movie("m1")), 16))
      .toEqual([{ kind: "item", id: "m1" }, { kind: "item", id: "A-s2e5" }]);
  });

  it("les films ne changent pas : mêmes cartes, même ordre", () => {
    const films = ["m1", "m2", "m3", "m4"].map(movie);
    expect(planLatestCards(inventory(...films), 16)).toEqual(
      ["m4", "m3", "m2", "m1"].map((id) => ({ kind: "item", id })),
    );
  });

  it("une saison entière : une carte, la saison nouvelle, ses épisodes comptés, la fiche ouverte dessus", () => {
    const plan = planLatestCards(inventory(episode("A", 1, 9), ...fullSeason("A", 2, 8), movie("m1")), 16);
    expect(plan[1]).toEqual({
      kind: "series",
      seriesId: "A",
      additions: {
        EpisodeCount: 9,
        SeasonNumbers: [1, 2],
        NewSeasonNumbers: [2],
        NewSeries: false,
        LatestDate: expect.any(String),
        LatestSeasonId: "A-s2",
        LatestSeasonNumber: 2,
      },
    });
    expect(summary(plan)).toEqual(["m1", "A:9e:S2"]);
  });

  it("une série nouvelle (son dossier, ses saisons, ses épisodes) est dite nouvelle", () => {
    const plan = planLatestCards(inventory(...fullSeason("N", 1, 6), ...fullSeason("N", 2, 6), series("N")), 16);
    expect(summary(plan)).toEqual(["N:12e:NS1+2"]);
    if (plan[0].kind !== "series") throw new Error("carte série attendue");
    // La série en tête : la saison de l'ajout le plus récent est celle du dernier épisode ou dossier de saison.
    expect(plan[0].additions.LatestSeasonId).toBe("N-s2");
  });

  it("les spéciaux comptent parmi les saisons concernées, jamais comme « nouvelle saison »", () => {
    const plan = planLatestCards(inventory(episode("A", 3, 1), season("A", 0), episode("A", 0, 1)), 16);
    if (plan[0].kind !== "series") throw new Error("carte série attendue");
    expect(plan[0].additions.SeasonNumbers).toEqual([0, 3]);
    expect(plan[0].additions.NewSeasonNumbers).toEqual([]);
  });
});

describe("planLatestCards — un dossier n'est nouveau qu'arrivé avec le dernier ajout", () => {
  const NOW = Date.parse("2026-10-02T20:00:00Z");
  const HOUR = 60 * 60 * 1000;
  /** Un ajout daté à `hoursAgo` heures du dernier. */
  const at = (addition: ScannedAddition, hoursAgo: number): ScannedAddition =>
    ({ ...addition, DateCreated: new Date(NOW - hoursAgo * HOUR).toISOString() });

  it("le dossier d'une série installée de longue date ne la dit pas nouvelle (bibliothèque calme)", () => {
    const plan = planLatestCards([
      at(episode("A", 1, 3), 0),
      at(season("A", 1), 60 * 24), at(series("A"), 60 * 24), at(episode("A", 1, 2), 60 * 24),
    ], 16);
    expect(summary(plan)).toEqual(["A:2e"]);
  });

  it("un épisode seul, suivi d'un vieux dossier de sa série, reste l'épisode", () => {
    const plan = planLatestCards([at(episode("A", 3, 2), 0), at(season("A", 3), 7 * 24)], 16);
    expect(plan).toEqual([{ kind: "item", id: "A-s3e2" }]);
  });

  it("une saison qui commence — son dossier et son premier épisode — est une nouvelle saison", () => {
    const plan = planLatestCards([at(season("A", 3), 0), at(episode("A", 3, 1), 0.01)], 16);
    expect(summary(plan)).toEqual(["A:1e:S3"]);
  });

  it("la fenêtre fait 24 h, bornes comprises", () => {
    const edge = planLatestCards([at(episode("A", 2, 2), 0), at(season("A", 2), 24), at(episode("A", 2, 1), 24)], 16);
    expect(summary(edge)).toEqual(["A:2e:S2"]);
    const past = planLatestCards([at(episode("A", 2, 2), 0), at(season("A", 2), 24.01), at(episode("A", 2, 1), 24.02)], 16);
    expect(summary(past)).toEqual(["A:2e"]);
  });
});

describe("planLatestCards — la longueur de la rangée", () => {
  it("jamais plus de cartes que demandé : vingt au plus côté proxy", () => {
    const films = Array.from({ length: 30 }, (_, i) => movie(`m${i}`));
    expect(planLatestCards(inventory(...films), 20)).toHaveLength(20);
  });

  it("une série regroupée laisse sa place : la rangée se complète avec les ajouts suivants", () => {
    // 3 films anciens, 12 séries, puis une saison de 40 épisodes d'une série.
    const older = [movie("m1"), movie("m2"), movie("m3")];
    const shows = Array.from({ length: 12 }, (_, i) => episode(`S${i}`, 1, 1));
    const plan = planLatestCards(inventory(...older, ...shows, ...fullSeason("BIG", 1, 40)), 16);
    expect(plan).toHaveLength(16);
    expect(summary(plan)[0]).toBe("BIG:40e:S1");
    expect(summary(plan).slice(-3)).toEqual(["m3", "m2", "m1"]);
  });

  it("la rangée s'arrête au premier ajout qui ouvrirait une carte de trop : le plus ancien ne compte pas", () => {
    // A arrive deux fois, mais son premier épisode est plus ancien que la 3e carte.
    const plan = planLatestCards(inventory(episode("A", 1, 1), movie("m1"), movie("m2"), episode("A", 1, 2)), 2);
    expect(summary(plan)).toEqual(["A-s1e2", "m2"]);
  });

  it("une série déjà en rangée accueille encore ses épisodes tant qu'aucune carte nouvelle n'est requise", () => {
    const plan = planLatestCards(inventory(episode("A", 1, 1), episode("A", 1, 2), movie("m2"), episode("A", 1, 3)), 2);
    expect(summary(plan)).toEqual(["A:3e", "m2"]);
  });
});

describe("planLatestCards — inventaire imparfait", () => {
  it("un ajout sans identifiant est ignoré ; un épisode sans série garde sa carte", () => {
    const plan = planLatestCards([{ Type: "Movie" }, { Id: "orphan", Type: "Episode" }, { Id: "f", Type: "Folder" }], 16);
    expect(plan).toEqual([{ kind: "item", id: "orphan" }, { kind: "item", id: "f" }]);
  });

  it("une saison seule (sans épisode dans la rangée) devient la carte de sa série", () => {
    const plan = planLatestCards(inventory(season("A", 4)), 16);
    expect(summary(plan)).toEqual(["A:0e:S4"]);
  });

  it("aucun ajout : aucune carte", () => {
    expect(planLatestCards([], 16)).toEqual([]);
  });
});
