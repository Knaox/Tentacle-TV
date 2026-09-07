import type { HeroSlide } from "@/components/hero/heroSlides";
import type { OfflineEntry } from "@/offline/engineApi";
import { BANNER_ART, ITEM_BANNER_ART, MOVIE_ART, SERIES_ART, resolveLocalArt } from "./offlineArt";
import { OfflineHeroContent } from "./OfflineHeroContent";

interface OfflineHeroHandlers {
  onPlay: (entry: OfflineEntry) => void;
  onInfo: (entry: OfflineEntry) => void;
}

/**
 * Les titres de l'appareil en diapositives du bandeau — le jumeau de
 * `mediaHeroSlides`, les visuels lus dans le snapshot (`file://`). Le halo
 * part de l'affiche (600 px suffisent à un flou), la pile d'images de la
 * bannière. Sans bannière ni affiche, le cadre tient avec ses voiles.
 *
 * `HeroBackdropStack` garde la politique de cache par défaut d'expo-image :
 * la réparation, qui réécrit un fichier sous le même nom, tourne au
 * démarrage du moteur, avant que l'accueil ne se monte.
 */
export function offlineHeroSlides(entries: readonly OfflineEntry[], handlers: OfflineHeroHandlers): HeroSlide[] {
  return entries.map((entry) => {
    const episode = entry.kind === "episode";
    const backdropUri = resolveLocalArt(entry.itemId, episode ? BANNER_ART : ITEM_BANNER_ART);
    return {
      id: entry.itemId,
      backdropUri,
      haloUri: resolveLocalArt(entry.itemId, episode ? SERIES_ART : MOVIE_ART) ?? backdropUri,
      render: (active) => (
        <OfflineHeroContent entry={entry} active={active} onPlay={handlers.onPlay} onInfo={handlers.onInfo} />
      ),
    };
  });
}
