import type { MediaItem, MyTitle, MyTitleState } from "@tentacle-tv/shared";
import type { BenchData } from "./benchData";

/**
 * Des titres attendus FACTICES (contrat `titles.mine`) sur les affiches de
 * l'instantané : chaque état, une longue liste, un seul titre. Aucun Vigie,
 * aucun Jellyseerr : la forme est celle que la vraie route renvoie, les mots
 * viennent des mêmes fonctions que l'app (`requestModels`).
 */

interface Spec {
  from: "movies" | "series";
  index: number;
  state: MyTitleState;
  percent?: number | null;
  seasons?: number[];
}

/* Un nom de l'instantané peut commencer par une marque de direction (U+200E). */
const clean = (name: string | undefined) => (name ?? "").replace(/^‎/, "").trim();

function toTitle(data: BenchData, spec: Spec, n: number): MyTitle | null {
  const item: MediaItem | undefined = data.list(spec.from)[spec.index];
  if (!item?.Id) return null;
  const mediaType = spec.from === "movies" ? "movie" : "tv";
  return {
    key: `${mediaType}:${9000 + n}`,
    mediaType,
    tmdbId: 9000 + n,
    title: clean(item.Name),
    year: item.ProductionYear ?? null,
    imageUrl: data.image(item.Id, "Primary") ?? null,
    seasons: mediaType === "tv" ? spec.seasons ?? null : null,
    state: spec.state,
    percent: spec.state === "arriving" ? spec.percent ?? null : null,
  };
}

function build(data: BenchData, specs: Spec[]): MyTitle[] {
  return specs.map((spec, n) => toTitle(data, spec, n)).filter((title): title is MyTitle => title !== null);
}

/** Les quatre états, et un titre en route dont l'avancement ne se sait pas encore. */
export const benchAllStates = (data: BenchData) => build(data, [
  { from: "series", index: 3, state: "arriving", percent: 42.6, seasons: [2, 3] },
  { from: "movies", index: 5, state: "pending" },
  { from: "movies", index: 3, state: "importing" },
  { from: "series", index: 5, state: "blocked", seasons: [1, 2, 3, 4, 6] },
  { from: "movies", index: 1, state: "arriving", percent: null },
]);

/** Une seule demande, en route. */
export const benchOne = (data: BenchData) => build(data, [{ from: "movies", index: 5, state: "arriving", percent: 76 }]);

/** Deux demandes. */
export const benchTwo = (data: BenchData) => build(data, [
  { from: "series", index: 4, state: "pending", seasons: [5] },
  { from: "movies", index: 3, state: "arriving", percent: 12 },
]);

/** Une longue liste : elle défile, ses lignes prennent alors le focus. */
export const benchLong = (data: BenchData) => build(data, [
  { from: "series", index: 3, state: "arriving", percent: 88 },
  { from: "movies", index: 5, state: "arriving", percent: 42 },
  { from: "movies", index: 3, state: "importing" },
  { from: "series", index: 5, state: "blocked", seasons: [2] },
  { from: "movies", index: 1, state: "pending" },
  { from: "series", index: 1, state: "pending", seasons: [1, 2, 3] },
  { from: "movies", index: 6, state: "pending" },
  { from: "series", index: 2, state: "arriving", percent: 3 },
  { from: "movies", index: 8, state: "pending" },
]);
