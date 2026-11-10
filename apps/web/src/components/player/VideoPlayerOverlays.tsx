import type { MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { useEndCardRating } from "@tentacle-tv/api-client";
import { LoadingBar } from "./PlayerLoadingScreen";
import { PlaybackSpinner } from "./PlaybackSpinner";
import { PlaybackOverlay } from "./PlaybackOverlay";
import { PlayIcon } from "../icons/transport";
import type { MediaItem, PlayerOverlay } from "@tentacle-tv/shared";

interface VideoPlayerOverlaysProps {
  loading: boolean;
  /** Une attente qui dure (saut pendant un transcodage) : la phrase sous l'indicateur. */
  loadingHint?: string;
  /** La première image a été rendue au moins une fois pour ce média. */
  hasStarted: boolean;
  showPlayButton: boolean;
  posterUrl?: string;
  overlay: PlayerOverlay;
  countdownTotals: { skipMs: number; nextMs: number };
  onSkip: () => void;
  onDismissOverlay: () => void;
  onPlayNow: () => void;
  /** La barre de contrôles est-elle à l'écran ? (le bouton lui cède la place). */
  controlsVisible: boolean;
  /** Un panneau du lecteur (pistes, épisodes) est ouvert : pilules effacées. */
  panelOpen: boolean;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextSeriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
  /** Média EN COURS — la notation de l'affiche de fin s'y adosse. */
  item?: MediaItem | null;
  /** Tue le décompte de la suite quand une note se pose. */
  onRatingEngage?: () => void;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  userInteractedRef: MutableRefObject<boolean>;
  setShowPlayButton: (v: boolean) => void;
}

/**
 * Overlays du player web : chargement (bannière initiale / spinner en cours de
 * lecture), bouton play (autoplay policy), badge « appuyer pour le son », et
 * la projection de l'ARBITRE (bouton de saut blanc, carte, affiche de fin).
 * Plus aucune décision de segments ici — tout vient de la coquille partagée.
 *
 * Tout est posé sur la vidéo → text-white/bg-black volontairement en dur,
 * identiques dans les deux thèmes clair/sombre.
 */
export function VideoPlayerOverlays({
  loading, loadingHint, hasStarted, showPlayButton, posterUrl,
  overlay, countdownTotals, onSkip, onDismissOverlay, onPlayNow, controlsVisible,
  panelOpen,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
  item, onRatingEngage,
  videoRef, userInteractedRef,
  setShowPlayButton,
}: VideoPlayerOverlaysProps) {
  const { t } = useTranslation("player");
  // Notation de l'épisode FINI, servie à l'affiche de fin seulement.
  const endCardRating = useEndCardRating(item);

  return (
    <>
      {/* Ces deux écrans se décidaient sur `sourceChangingRef.current` et
          `hasStartedRef.current`. Muter une ref ne re-rend rien : au montage du
          lecteur elles valaient encore `false`, la condition était fausse, et
          l'utilisateur voyait un ÉCRAN NOIR entre la bannière de la page et la
          première image. Tout se lit désormais dans l'état. */}
      {!showPlayButton && (hasStarted ? (
        // Buffering EN COURS de lecture (réseau qui cale) : spinner discret.
        loading && <PlaybackSpinner hint={loadingHint} />
      ) : (
        // Chargement INITIAL du média : bannière (backdrop) + barre de chargement.
        // Tenue sans interruption du montage jusqu'à la première image.
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden bg-[#0B0B0C]" onClick={(e) => e.stopPropagation()}>
          {posterUrl && <img src={posterUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/35" />
          <div className="absolute inset-x-0 bottom-0 px-8 pb-14 md:px-16 md:pb-20"><LoadingBar /></div>
        </div>
      ))}

      {showPlayButton && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            e.stopPropagation(); userInteractedRef.current = true;
            const v = videoRef.current;
            if (v) v.play().then(() => setShowPlayButton(false)).catch(() => {});
          }}>
          <div className="flex flex-col items-center gap-3">
            <PlayIcon className="h-20 w-20 text-white/90" aria-hidden />
            <span className="text-sm text-white/70">{t("player:pressToPlay")}</span>
          </div>
        </div>
      )}


      <PlaybackOverlay
        overlay={overlay}
        countdownTotals={countdownTotals}
        onSkip={onSkip}
        onDismiss={onDismissOverlay}
        onPlayNow={onPlayNow}
        layer="z-50"
        controlsVisible={controlsVisible}
        panelOpen={panelOpen}
        nextEpisodeTitle={nextEpisodeTitle}
        nextEpisodeDescription={nextEpisodeDescription}
        nextEpisodeImageUrl={nextEpisodeImageUrl}
        nextSeriesBackdropUrl={nextSeriesBackdropUrl}
        nextEpisodeThumbUrl={nextEpisodeThumbUrl}
        endCardRating={endCardRating}
        onEndCardRatingEngage={onRatingEngage}
      />
    </>
  );
}
