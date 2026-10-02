import { MY_TITLE_PERCENT_KEY, MY_TITLE_STATE_KEYS, seasonRuns, type MyTitle } from "@tentacle-tv/shared";
import { livelyFirst } from "@tentacle-tv/tv-core";
import type { RequestItemModel, RequestsDockModel } from "../../redesign/requests/requestTypes";
import { ARRIVED_LABEL_KEY, STILL_READING, arrivalOf, arrivedModel, type ArrivalReading } from "./arrivalModels";

/**
 * Des titres attendus (contrat `titles.mine`) aux modèles des vues — les mots
 * de l'interface (espace `requests`), une seule fois ici : l'app et le banc
 * passent par les mêmes fonctions. `reading` : la lecture d'où partent les
 * vues (son heure, et si on la voit — l'avancement bouge alors seul).
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** L'aperçu du rail en montre au plus autant. */
const PEEK_POSTERS = 3;

/** « Saison 3 », « Saisons 1–4 et 6 » ; `null` sans saison. */
export function seasonsText(seasons: readonly number[] | null, t: Translate): string | null {
  if (!seasons?.length) return null;
  const parts = seasonRuns(seasons);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} ${t("requests:and")} ${parts[parts.length - 1]}`;
  return t("requests:seasons", { count: seasons.length, list });
}

export function requestItemModel(title: MyTitle, t: Translate, reading: ArrivalReading = STILL_READING): RequestItemModel {
  const detail = [title.year ? String(title.year) : null, seasonsText(title.seasons, t)].filter(Boolean).join(" · ");
  return {
    key: title.key,
    title: title.title,
    detail: detail || null,
    imageUri: title.imageUrl,
    arrival: arrivalOf(title, reading),
    stateLabel: t(MY_TITLE_STATE_KEYS[title.state]),
    arrivedLabel: t(ARRIVED_LABEL_KEY),
    percentLabel: title.percent === null ? null : t(MY_TITLE_PERCENT_KEY, { percent: Math.floor(title.percent) }),
  };
}

/** « 3 demandes » ; `null` tant que la liste n'est pas lue. */
export function requestsCountText(titles: readonly MyTitle[] | null, t: Translate): string | null {
  if (titles === null) return null;
  return titles.length === 0 ? null : t("requests:count", { count: titles.length });
}

/**
 * L'aperçu du rail : ce qui bouge d'abord (`livelyFirst`) — le direct s'y voit
 * d'un coup d'œil —, et devant tout, le temps de se montrer, ce qui vient
 * d'arriver (`arrived` : en pleine couleur, son camembert qui s'efface).
 */
export function requestsDockModel(
  titles: readonly MyTitle[] | null,
  t: Translate,
  reading: ArrivalReading = STILL_READING,
  arrived: readonly MyTitle[] = [],
): RequestsDockModel {
  const current = titles ?? [];
  const posters = [
    ...arrived.map((title) => ({ key: title.key, uri: title.imageUrl, arrival: arrivedModel(reading) })),
    ...livelyFirst(current).map((title) => ({ key: title.key, uri: title.imageUrl, arrival: arrivalOf(title, reading) })),
  ];
  return {
    label: t("requests:dockLabel"),
    caption: titles === null ? null : current.length === 0 ? t("requests:dockEmpty") : requestsCountText(current, t),
    posters: posters.slice(0, PEEK_POSTERS),
    count: current.length,
  };
}
