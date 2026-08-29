import { useSyncExternalStore, type ComponentProps } from "react";
import { VideoPlayerOverlays as WebOverlays } from "@/components/player/VideoPlayerOverlays?original";
import { PlaybackOverlayTv } from "./PlaybackOverlayTv";
import { subscribeFreeze, readFreeze } from "./freezeStateTv";

/**
 * Les surcouches du lecteur, moins la projection de l'arbitre.
 *
 * **On enveloppe, on ne recopie pas.** Écran de chargement, spinner, bouton de
 * démarrage, pilule « appuyer pour le son » : tout cela convient tel quel.
 * Seule la projection de l'ARBITRE (bouton de saut, carte, affiche de fin) est
 * détournée — on neutralise l'overlay du rendu web et on le rend nous-mêmes,
 * avec l'ancrage d'overscan et la prise de focus qu'exige une dalle. Même
 * motif qu'avant la refonte, une seule couture au lieu de trois.
 *
 * Une seule propriété est ENRICHIE : le chargement. Sur le gel propre à cette
 * pile média, le lecteur n'émet aucun événement — la veille de gel, elle, le
 * voit, et allume LE cercle qui existe déjà.
 */
export function VideoPlayerOverlays(props: ComponentProps<typeof WebOverlays>) {
  const frozen2 = useSyncExternalStore(subscribeFreeze, readFreeze, readFreeze);

  return (
    <>
      <WebOverlays {...props} loading={props.loading || frozen2} overlay={{ kind: "none" }} />
      <PlaybackOverlayTv
        overlay={props.overlay}
        countdownTotals={props.countdownTotals}
        onSkip={props.onSkip}
        onDismiss={props.onDismissOverlay}
        onPlayNow={props.onPlayNow}
        nextEpisodeTitle={props.nextEpisodeTitle}
        nextEpisodeDescription={props.nextEpisodeDescription}
        nextEpisodeImageUrl={props.nextEpisodeImageUrl}
        nextSeriesBackdropUrl={props.nextSeriesBackdropUrl}
        nextEpisodeThumbUrl={props.nextEpisodeThumbUrl}
      />
    </>
  );
}
