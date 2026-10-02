import { i18n, MY_TITLE_STATE_KEYS, type MyTitle } from "@tentacle-tv/shared";
import type { ArrivalState } from "../../../src/redesign/requests/arrivalTypes";
import { EMPTY_MARKERS, type CardModel } from "../../../src/redesign/cards/cardTypes";
import { ARRIVED_LABEL_KEY, arrivalOf, arrivedModel, type ArrivalReading } from "../../../src/redesignWiring/vigie/arrivalModels";
import type { BenchData } from "./benchData";

/**
 * Les demandes EN DIRECT au banc — des demandes du compte FACTICES sur les
 * affiches de l'instantané, résolues par les mêmes fonctions que le câblage
 * (`arrivalOf`, `arrivedModel`). Aucun Vigie, aucune demande : la forme est
 * celle de `titles.mine`, avec son temps restant.
 */

export const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

/** L'affiche des bandes (« Projet Dernière Chance ») : des couleurs franches, un visage. */
const POSTER_INDEX = 5;

function wordOf(state: ArrivalState): string {
  return t(state === "arrived" ? ARRIVED_LABEL_KEY : MY_TITLE_STATE_KEYS[state]);
}

/** Un titre attendu du compte, à l'état voulu (`etaSeconds` : il avance seul quand on le voit). */
export function benchMine(data: BenchData, n: number, state: MyTitle["state"], percent: number | null = null, etaSeconds: number | null = null, from: "movies" | "series" = "movies", index = POSTER_INDEX): MyTitle {
  const item = data.list(from)[index];
  const mediaType = from === "movies" ? "movie" : "tv";
  return {
    key: `${mediaType}:${9100 + n}`,
    mediaType,
    tmdbId: 9100 + n,
    title: (item?.Name ?? "").replace(/^‎/, "").trim(),
    year: item?.ProductionYear ?? null,
    imageUrl: item?.Id ? data.image(item.Id, "Primary") ?? null : null,
    seasons: null,
    state,
    percent: state === "arriving" ? percent : null,
    etaSeconds: state === "arriving" ? etaSeconds : null,
  };
}

/** La carte d'un titre absent que le compte attend — comme la saga ou la recherche la montrent. */
export function arrivalCard(data: BenchData, id: string, state: ArrivalState, percent: number | null, reading: ArrivalReading, etaSeconds: number | null = null): CardModel {
  const item = data.list("movies")[POSTER_INDEX];
  const arrival = state === "arrived" ? arrivedModel(reading) : arrivalOf(benchMine(data, 0, state, percent, etaSeconds), reading);
  return {
    id,
    title: (item?.Name ?? "").replace(/^‎/, "").trim(),
    subtitle: item?.ProductionYear ? String(item.ProductionYear) : undefined,
    posterUri: item?.Id ? data.image(item.Id, "Primary") : undefined,
    markers: EMPTY_MARKERS,
    absent: { label: wordOf(state), tone: state === "arrived" ? "ready" : "pending", arrival },
  };
}

/** La même affiche à 0, 25, 50, 75 et 100 % : la couleur au prorata. */
export const LEVELS: Array<[ArrivalState, number | null]> = [["arriving", 0], ["arriving", 25], ["arriving", 50], ["arriving", 75], ["arriving", 100]];

/** Chaque état : en attente, en route, mise en bibliothèque, bloquée, arrivée. */
export const STATES: Array<[ArrivalState, number | null]> = [["pending", null], ["arriving", 42], ["importing", null], ["blocked", null], ["arrived", null]];

/** La fenêtre et l'aperçu en direct : deux titres qui avancent (temps restant court, pour le voir), le reste. */
export const benchLiveTitles = (data: BenchData): MyTitle[] => [
  benchMine(data, 1, "arriving", 38, 150, "series", 3),
  benchMine(data, 2, "pending", null, null, "movies", 1),
  benchMine(data, 3, "arriving", 8, 600, "movies", 3),
  benchMine(data, 4, "importing", null, null, "series", 5),
  benchMine(data, 5, "blocked", null, null, "movies", 6),
];
