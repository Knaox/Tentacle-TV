import { i18n, type TitleSeason, type TitleSeasonsAnswer } from "@tentacle-tv/shared";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import type { MissingSeasonTabModel } from "../../../src/redesign/screens/detail/detailTypes";
import type { SeasonsSheetModel } from "../../../src/redesign/screens/requests/SeasonsSheet";
import { absentCard } from "../../../src/redesignWiring/cards/absentCards";
import { seasonsSheetModel } from "../../../src/redesignWiring/vigie/seasonsSheetModel";
import { t } from "./absentModels";
import type { BenchData } from "./benchData";
import { cardOf } from "./models";

/**
 * Les saisons MANQUANTES d'une série de la bibliothèque, au banc : Bleach,
 * quinze saisons réelles dans l'instantané, à qui l'on fait manquer — en
 * EXEMPLE — ses saisons 16 et 17 : la 16 demandée par quelqu'un, la 17 à
 * demander. Résolu par les MÊMES fonctions que le câblage (`absentCard`,
 * `seasonsSheetModel`) ; le banc ne demande jamais rien.
 */

export const BLEACH = "37ef170883b345300ba7bdabcca7c084";

const fr = () => i18n.language.startsWith("fr");

/** Ce que l'extension dirait des saisons de Bleach (`titles.seasons`). */
function seasons(): TitleSeason[] {
  const available = { label: fr() ? "Disponible" : "Available", tone: "success" as const };
  const requested = { label: fr() ? "Demandée" : "Requested", tone: "info" as const };
  const out: TitleSeason[] = [];
  for (let n = 1; n <= 15; n++) out.push({ number: n, name: t("requests:seasonFallback", { number: n }), episodeCount: 20, badge: available, requestable: false });
  out.push({ number: 16, name: t("requests:seasonFallback", { number: 16 }), episodeCount: 13, badge: requested, requestable: false });
  out.push({ number: 17, name: t("requests:seasonFallback", { number: 17 }), episodeCount: 13, badge: null, requestable: true });
  return out;
}

/** Ce qui manque à Bleach (`titles.gaps`) : les saisons 16 et 17. */
export const gapSeasons = () => seasons().filter((season) => season.number > 15);

/** Les saisons que la bibliothèque a : la bande de la fiche, de 1 à 15. */
export const LIBRARY = new Set(Array.from({ length: 15 }, (_, i) => i + 1));

/** La carte de Bleach en tête de « À demander » : son affiche de la bibliothèque, grisée. */
export function gapSearchCard(data: BenchData): CardModel[] {
  const item = data.item(BLEACH);
  if (!item) return [];
  const count = gapSeasons().filter((season) => season.requestable).length;
  return [{
    ...absentCard({
      id: `gap:${BLEACH}`,
      title: item.Name ?? "Bleach",
      year: item.ProductionYear,
      posterUri: cardOf(data, item).posterUri,
      absent: { label: t("requests:missingSeasons", { count }), tone: "neutral" },
    }),
    focusNote: t("requests:hintSeasons"),
  }];
}

/** Les onglets grisés de la fiche (`useSeriesGapTabs`). */
export function missingTabs(): MissingSeasonTabModel[] {
  return gapSeasons().map((season) => ({
    number: season.number,
    label: season.name ?? t("requests:seasonFallback", { number: season.number }),
    requestable: season.requestable,
    status: season.requestable ? t("requests:seasonToRequest") : season.badge?.label ?? "",
  }));
}

/** La feuille des saisons de Bleach : ce qu'on a regroupé, la 16 dite, la 17 à cocher. */
export function gapSheet(checked: number[] = []): SeasonsSheetModel {
  const answer: TitleSeasonsAnswer = { seasons: seasons(), failure: null };
  return seasonsSheetModel(t, "Bleach", answer, false, new Set(checked), LIBRARY);
}
