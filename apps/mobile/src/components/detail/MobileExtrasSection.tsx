import { useTranslation } from "react-i18next";
import { useFicheExtras } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { MOBILE_TRAILER_PLATFORM } from "@/trailers/trailerPlatform";
import { MobileExtrasCarousel } from "./MobileExtrasCarousel";

/**
 * Section « Extras » (mobile) : UN carrousel par fiche, jamais des rangées
 * empilées (décision de Damien, 2026-10-14 ; règle partagée `ficheExtrasPlan`).
 *  - Film : ses bandes-annonces locales, bonus, puis vidéos en ligne.
 *  - Série : les siens et ceux de toutes ses saisons, réunis — le nom de la
 *    saison devant chaque tuile.
 *  - Épisode : ceux de SA saison s'il y en a ; sinon tous les autres.
 * Avec le catalogue du serveur (`trailers.catalog`), ses vidéos — AlloCiné
 * compris — s'ouvrent dans l'écran des bandes-annonces sur le catalogue de la
 * fiche. Sans lui, les vidéos YouTube d'avant. Rien à montrer : rien.
 */
export function MobileExtrasSection({ item, seriesItem }: { item: MediaItem; seriesItem?: MediaItem }) {
  const { i18n } = useTranslation();
  const extras = useFicheExtras(item, seriesItem, i18n.language, MOBILE_TRAILER_PLATFORM);
  return <MobileExtrasCarousel {...extras} fiche={{ itemId: item.Id, itemType: item.Type }} />;
}
