import { MY_TITLE_PERCENT_KEY, MY_TITLE_STATE_KEYS, seasonRuns, type MyTitle } from "@tentacle-tv/shared";
import type { RequestItemModel, RequestsDockModel } from "../../redesign/requests/requestTypes";

/**
 * Des titres attendus (contrat `titles.mine`) aux modèles des vues — les mots
 * de l'interface (espace `requests`), une seule fois ici : l'app et le banc
 * passent par les mêmes fonctions.
 */

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** « Saison 3 », « Saisons 1–4 et 6 » ; `null` sans saison. */
export function seasonsText(seasons: readonly number[] | null, t: Translate): string | null {
  if (!seasons?.length) return null;
  const parts = seasonRuns(seasons);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} ${t("requests:and")} ${parts[parts.length - 1]}`;
  return t("requests:seasons", { count: seasons.length, list });
}

export function requestItemModel(title: MyTitle, t: Translate): RequestItemModel {
  const detail = [title.year ? String(title.year) : null, seasonsText(title.seasons, t)].filter(Boolean).join(" · ");
  return {
    key: title.key,
    title: title.title,
    detail: detail || null,
    imageUri: title.imageUrl,
    state: title.state,
    stateLabel: t(MY_TITLE_STATE_KEYS[title.state]),
    percent: title.percent,
    percentLabel: title.percent === null ? null : t(MY_TITLE_PERCENT_KEY, { percent: Math.floor(title.percent) }),
  };
}

/** « 3 demandes » ; `null` tant que la liste n'est pas lue. */
export function requestsCountText(titles: readonly MyTitle[] | null, t: Translate): string | null {
  if (titles === null) return null;
  return titles.length === 0 ? null : t("requests:count", { count: titles.length });
}

export function requestsDockModel(titles: readonly MyTitle[] | null, t: Translate): RequestsDockModel {
  return {
    label: t("requests:dockLabel"),
    caption: titles === null ? null : titles.length === 0 ? t("requests:dockEmpty") : requestsCountText(titles, t),
    posters: (titles ?? []).slice(0, 3).map((title) => ({ key: title.key, uri: title.imageUrl })),
    count: titles?.length ?? 0,
  };
}
