import type { TFunction } from "i18next";
import { requestableSeasonNumbers, seasonPick, type TitleSeasonsAnswer } from "@tentacle-tv/shared";
import type { SeasonsSheetModel } from "../../redesign/screens/requests/SeasonsSheet";

/**
 * La feuille des saisons mise en mots — le modèle commun aux plateformes
 * (`seasonPick`, shared) dans la forme de la vue TV. Les saisons dans l'ordre
 * que l'extension donne (numérotées, puis les épisodes spéciaux) ; celles qui
 * ne se demandent plus disent où elles en sont, avec les mots de
 * l'extension ; celles que la bibliothèque a déjà (`library`, une série de la
 * bibliothèque) disent « Dans la bibliothèque » et ne se cochent pas.
 */

export function seasonsSheetModel(
  t: TFunction,
  title: string,
  answer: TitleSeasonsAnswer | null,
  failed: boolean,
  checked: ReadonlySet<number>,
  library?: ReadonlySet<number> | null,
): SeasonsSheetModel {
  const pick = seasonPick(t, answer, failed, checked, library);
  return {
    title,
    subtitle: t("requests:seasonsSubtitle"),
    seasons: pick.rows,
    message: pick.message,
    submit: pick.submitLabel ? { label: pick.submitLabel, kind: "request" } : { label: t("common:close"), kind: "close" },
  };
}

/** Les saisons qui se cochent, dans leur ordre — hors celles que la bibliothèque a. */
export function requestableNumbers(answer: TitleSeasonsAnswer | null, library?: ReadonlySet<number> | null): number[] {
  return requestableSeasonNumbers(answer, library);
}
