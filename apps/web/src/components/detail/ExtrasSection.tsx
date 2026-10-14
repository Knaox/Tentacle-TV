import { useTranslation } from "react-i18next";
import { useFicheExtras } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { ExtrasRow } from "./ExtrasRow";
import { useWebTrailerPlatform } from "./trailerPlatform";

/**
 * Section « Extras » de la page détail : UN carrousel (`useFicheExtras`) —
 * jamais une rangée par saison empilée.
 *
 *  - Film : ses bandes-annonces locales, ses bonus, ses vidéos en ligne.
 *  - Série : les siens et ceux de toutes ses saisons, réunis.
 *  - Épisode : ceux de SA saison s'il y en a, sinon tous les autres.
 *
 * Avec le catalogue du serveur (lecteur complet), ses vidéos — AlloCiné
 * compris, la langue du serveur d'abord. Le carrousel se masque sans extra.
 */
export function ExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { i18n } = useTranslation();
  const { owners, remote, catalog, title, seasonNames } = useFicheExtras(item, seriesItem, i18n.language, useWebTrailerPlatform());
  return <ExtrasRow owners={owners} remoteTrailers={remote} catalog={catalog} title={title} seasonNames={seasonNames} />;
}
