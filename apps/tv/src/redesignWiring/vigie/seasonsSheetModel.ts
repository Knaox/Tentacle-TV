import type { TFunction } from "i18next";
import {
  MY_TITLE_STATE_KEYS,
  requestableSeasonNumbers,
  seasonPick,
  type MyTitle,
  type SeasonPickRow,
  type TitleSeasonsAnswer,
} from "@tentacle-tv/shared";
import type { SeasonRowModel, SeasonsSheetModel } from "../../redesign/screens/requests/SeasonsSheet";
import { arrivalOf, type ArrivalReading } from "./arrivalModels";

/**
 * La feuille des saisons mise en mots — le modèle commun aux plateformes
 * (`seasonPick`, shared) dans la forme de la vue TV. Les saisons dans l'ordre
 * que l'extension donne (numérotées, puis les épisodes spéciaux) ; celles qui
 * ne se demandent plus disent où elles en sont, avec les mots de
 * l'extension ; celles que la bibliothèque a déjà (`library`, une série de la
 * bibliothèque) disent « Dans la bibliothèque » et ne se cochent pas.
 *
 * Apple TV : les saisons demandées qui font partie de la demande du COMPTE en
 * cours (`own`) disent son état, son camembert et son avancement en direct.
 */

/** La demande du compte sur cette série, et la lecture d'où partent les vues. */
export interface OwnSeasonsRequest {
  mine: MyTitle;
  reading: ArrivalReading;
}

/** Une saison demandée de la demande du compte (la série entière : toute saison demandée). */
function ownsRow(row: SeasonPickRow, own: OwnSeasonsRequest): boolean {
  return row.status?.tone === "pending" && (own.mine.seasons === null || own.mine.seasons.includes(row.number));
}

function withOwn(t: TFunction, rows: SeasonPickRow[] | null, own: OwnSeasonsRequest | null): SeasonRowModel[] | null {
  if (!rows || !own) return rows;
  return rows.map((row) =>
    ownsRow(row, own)
      ? { ...row, status: { label: t(MY_TITLE_STATE_KEYS[own.mine.state]), tone: "pending", arrival: arrivalOf(own.mine, own.reading) } }
      : row,
  );
}

export function seasonsSheetModel(
  t: TFunction,
  title: string,
  answer: TitleSeasonsAnswer | null,
  failed: boolean,
  checked: ReadonlySet<number>,
  library?: ReadonlySet<number> | null,
  own: OwnSeasonsRequest | null = null,
): SeasonsSheetModel {
  const pick = seasonPick(t, answer, failed, checked, library);
  return {
    title,
    subtitle: t("requests:seasonsSubtitle"),
    seasons: withOwn(t, pick.rows, own),
    message: pick.message,
    submit: pick.submitLabel ? { label: pick.submitLabel, kind: "request" } : { label: t("common:close"), kind: "close" },
  };
}

/** Les saisons qui se cochent, dans leur ordre — hors celles que la bibliothèque a. */
export function requestableNumbers(answer: TitleSeasonsAnswer | null, library?: ReadonlySet<number> | null): number[] {
  return requestableSeasonNumbers(answer, library);
}
