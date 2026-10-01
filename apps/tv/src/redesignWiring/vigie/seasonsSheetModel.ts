import type { TFunction } from "i18next";
import type { TitleSeason, TitleSeasonsAnswer } from "@tentacle-tv/shared";
import type { SeasonRowModel, SeasonsSheetModel, SeasonStatusTone } from "../../redesign/screens/requests/SeasonsSheet";

/**
 * La feuille des saisons mise en mots — pur. Les saisons dans l'ordre que
 * l'extension donne (numérotées, puis les épisodes spéciaux) ; celles qui ne
 * se demandent plus disent où elles en sont, avec les mots de l'extension.
 */

function toneOf(badge: TitleSeason["badge"]): SeasonStatusTone {
  if (badge?.tone === "success") return "ready";
  return badge?.tone === "info" ? "pending" : "neutral";
}

function rowOf(t: TFunction, season: TitleSeason, checked: ReadonlySet<number>): SeasonRowModel {
  return {
    number: season.number,
    label: season.name ?? t("requests:seasonFallback", { number: season.number }),
    detail: season.episodeCount !== null ? t("requests:seasonEpisodes", { count: season.episodeCount }) : undefined,
    status: season.requestable ? undefined : { label: season.badge?.label ?? "", tone: toneOf(season.badge) },
    selected: season.requestable && checked.has(season.number),
  };
}

export function seasonsSheetModel(
  t: TFunction,
  title: string,
  answer: TitleSeasonsAnswer | null,
  failed: boolean,
  checked: ReadonlySet<number>,
): SeasonsSheetModel {
  const seasons = answer ? answer.seasons.map((season) => rowOf(t, season, checked)) : null;
  let message: string | undefined;
  if (failed || answer?.failure != null) message = t("requests:seasonsFailed");
  else if (!answer) message = t("requests:seasonsLoading");
  else if (!answer.seasons.some((s) => s.requestable)) message = t("requests:seasonsNone");
  const count = checked.size;
  return {
    title,
    subtitle: t("requests:seasonsSubtitle"),
    seasons,
    message,
    submitLabel: count > 0 ? t("requests:seasonsSubmit", { count }) : t("requests:seasonsSubmitNone"),
    canSubmit: count > 0,
  };
}

/** Les saisons qui se cochent, dans leur ordre. */
export function requestableNumbers(answer: TitleSeasonsAnswer | null): number[] {
  return (answer?.seasons ?? []).filter((s) => s.requestable).map((s) => s.number);
}
