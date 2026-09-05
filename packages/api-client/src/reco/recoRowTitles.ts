/**
 * Les titres des rangées de recommandation sont du ressort des CLIENTS (le
 * serveur n'envoie que la clé, et le titre de la graine) : une seule table
 * clé → clé i18n (namespace `reco`), partagée par la page Recommandations,
 * l'accueil configurable et son éditeur, sur le web comme sur mobile et TV.
 */
export const RECO_ROW_TITLE_KEYS: Readonly<Record<string, string>> = {
  forYou: "rowForYou",
  inLibrary: "rowInLibrary",
  discover: "rowDiscover",
  community: "rowCommunity",
  exploration: "rowExploration",
  trending: "rowTrending",
  serverPulse: "rowServerPulse",
  bestOfLibrary: "rowBestOfLibrary",
  anime: "rowAnime",
};

export interface RecoRowTitle {
  /** Clé i18n dans le namespace `reco`. */
  key: string;
  params?: Record<string, string>;
}

/** Le titre d'une rangée servie (`forYou`, `becauseYouLiked:movie:603`,
 *  `withActor:287`…) ou d'une clé de rangée de l'accueil déjà dépouillée de
 *  son préfixe `reco:`. Clé inconnue : « Pour vous », jamais une erreur. */
export function recoRowTitle(row: { key: string; seedTitle?: string }): RecoRowTitle {
  if (row.key.startsWith("becauseYouLiked:")) {
    return { key: "rowBecauseYouLiked", params: { title: row.seedTitle ?? "" } };
  }
  if (row.key.startsWith("withActor:")) {
    return { key: "rowWithActor", params: { name: row.seedTitle ?? "" } };
  }
  return { key: RECO_ROW_TITLE_KEYS[row.key] ?? "rowForYou" };
}
