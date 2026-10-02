/**
 * La feuille des SAISONS à demander d'une série — le modèle UNIQUE que le
 * bureau, le mobile et l'Apple TV rendent, chacun à sa façon (pur, sans
 * React) : une ligne par saison, dans l'ordre que donne l'extension
 * (`titles.seasons`, `pluginTitleSeasons.ts`).
 *
 * Ce qui se demande, et où en sont les autres saisons, c'est l'extension qui
 * le dit, avec ses mots (« Demandée »). Le client n'y ajoute qu'UNE chose,
 * qu'il sait mieux qu'elle : les saisons que SA bibliothèque a déjà
 * (`library`) — « Dans la bibliothèque », jamais à cocher, même quand
 * l'extension n'en sait encore rien. On ne demande pas ce qu'on a. Trois
 * saisons numérotées ou plus qu'on a tiennent en UNE ligne (« Saisons 1–15 »,
 * `seasonRuns`) : ce qui manque à une longue série reste en vue.
 *
 * Les mots du client : espace `requests` (jamais « téléchargement »).
 */

import type { TFunction } from "i18next";
import type { TitleSeason, TitleSeasonsAnswer } from "./pluginTitleSeasons";
import { seasonRuns } from "./pluginTitlesMine";

/** Au-delà, les saisons numérotées qu'on a tiennent en une ligne. */
const GROUP_FROM = 3;

/** Le ton d'une saison qui ne se coche pas : là (`ready`), demandée (`pending`), sinon neutre. */
export type SeasonPickTone = "ready" | "pending" | "neutral";

export interface SeasonPickRow {
  number: number;
  /** « Saison 1 », « Épisodes spéciaux ». */
  label: string;
  /** « 10 épisodes ». */
  detail?: string;
  /** Pas à cocher : où elle en est — « Dans la bibliothèque », « Demandée ». */
  status?: { label: string; tone: SeasonPickTone };
  selected: boolean;
}

export interface SeasonPick {
  /** `null` : elles se lisent encore. */
  rows: SeasonPickRow[] | null;
  /** Leur lecture, un échec, ou rien à demander — à la place d'une liste à cocher. */
  message?: string;
  /** Les saisons qui se cochent, dans leur ordre. */
  requestable: number[];
  /** Les saisons cochées qui partiront, dans leur ordre. */
  chosen: number[];
  /** « Demander 2 saisons » dès qu'une saison est cochée ; `null` avant. */
  submitLabel: string | null;
}

function toneOf(badge: TitleSeason["badge"]): SeasonPickTone {
  if (badge?.tone === "success") return "ready";
  return badge?.tone === "info" ? "pending" : "neutral";
}

/** Une saison se coche si l'extension l'offre ET que la bibliothèque ne l'a pas. */
function isRequestable(season: TitleSeason, library: ReadonlySet<number> | null | undefined): boolean {
  return season.requestable && !library?.has(season.number);
}

/**
 * Les saisons que la bibliothèque A — leurs numéros, lus sur les saisons
 * Jellyfin de la série. Une saison « virtuelle » (épisodes manquants que
 * Jellyfin affiche sans fichier) n'est pas là.
 */
export function librarySeasonNumbers(
  seasons: ReadonlyArray<{ IndexNumber?: number | null; LocationType?: string | null }>,
): Set<number> {
  const out = new Set<number>();
  for (const season of seasons) {
    if (typeof season.IndexNumber === "number" && season.LocationType !== "Virtual") out.add(season.IndexNumber);
  }
  return out;
}

/** Les saisons qui se cochent, dans leur ordre. */
export function requestableSeasonNumbers(
  answer: TitleSeasonsAnswer | null,
  library?: ReadonlySet<number> | null,
): number[] {
  return (answer?.seasons ?? []).filter((season) => isRequestable(season, library)).map((season) => season.number);
}

function rowOf(
  t: TFunction,
  season: TitleSeason,
  checked: ReadonlySet<number>,
  library: ReadonlySet<number> | null | undefined,
): SeasonPickRow {
  const base = {
    number: season.number,
    label: season.name ?? t("requests:seasonFallback", { number: season.number }),
    detail: season.episodeCount !== null ? t("requests:seasonEpisodes", { count: season.episodeCount }) : undefined,
  };
  if (library?.has(season.number)) {
    return { ...base, status: { label: t("requests:seasonInLibrary"), tone: "ready" }, selected: false };
  }
  if (!season.requestable) {
    return { ...base, status: { label: season.badge?.label ?? "", tone: toneOf(season.badge) }, selected: false };
  }
  return { ...base, selected: checked.has(season.number) };
}

/** « Saisons 1–4, 6 et 8 » : les morceaux de `seasonRuns`, joints dans la langue. */
function seasonsLabel(t: TFunction, numbers: number[]): string {
  const parts = seasonRuns(numbers);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} ${t("requests:and")} ${parts[parts.length - 1]}`;
  return t("requests:seasons", { count: numbers.length, list });
}

/** Les lignes, dans l'ordre de l'extension ; les saisons numérotées qu'on a, regroupées à la première. */
function rowsOf(
  t: TFunction,
  seasons: readonly TitleSeason[],
  checked: ReadonlySet<number>,
  library: ReadonlySet<number> | null | undefined,
): SeasonPickRow[] {
  const owned = seasons.filter((season) => season.number > 0 && library?.has(season.number)).map((season) => season.number);
  const grouped = owned.length >= GROUP_FROM;
  const rows: SeasonPickRow[] = [];
  for (const season of seasons) {
    if (grouped && owned.includes(season.number)) {
      if (season.number !== owned[0]) continue;
      rows.push({
        number: season.number,
        label: seasonsLabel(t, owned),
        status: { label: t("requests:seasonInLibrary"), tone: "ready" },
        selected: false,
      });
      continue;
    }
    rows.push(rowOf(t, season, checked, library));
  }
  return rows;
}

export function seasonPick(
  t: TFunction,
  answer: TitleSeasonsAnswer | null,
  failed: boolean,
  checked: ReadonlySet<number>,
  library?: ReadonlySet<number> | null,
): SeasonPick {
  const rows = answer ? rowsOf(t, answer.seasons, checked, library) : null;
  const requestable = requestableSeasonNumbers(answer, library);
  let message: string | undefined;
  if (failed || answer?.failure != null) message = t("requests:seasonsFailed");
  else if (!answer) message = t("requests:seasonsLoading");
  else if (requestable.length === 0) message = t("requests:seasonsNone");
  const chosen = requestable.filter((number) => checked.has(number));
  return {
    rows,
    message,
    requestable,
    chosen,
    submitLabel: chosen.length > 0 ? t("requests:seasonsSubmit", { count: chosen.length }) : null,
  };
}
