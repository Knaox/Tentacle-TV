import type { MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { LoadingBar } from "./PlayerLoadingScreen";
import { PlaybackOverlay } from "./PlaybackOverlay";
import type { PlayerOverlay } from "@tentacle-tv/shared";

interface VideoPlayerOverlaysProps {
  loading: boolean;
  playing: boolean;
  /** La première image a été rendue au moins une fois pour ce média. */
  hasStarted: boolean;
  showPlayButton: boolean;
  policyMuted: boolean;
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
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  userInteractedRef: MutableRefObject<boolean>;
  setShowPlayButton: (v: boolean) => void;
  setPolicyMuted: (v: boolean) => void;
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
  loading, playing, hasStarted, showPlayButton, policyMuted, posterUrl,
  overlay, countdownTotals, onSkip, onDismissOverlay, onPlayNow, controlsVisible,
  panelOpen,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
  videoRef, userInteractedRef,
  setShowPlayButton, setPolicyMuted,
}: VideoPlayerOverlaysProps) {
  const { t } = useTranslation("player");

  return (
    <>
      {/* Ces deux écrans se décidaient sur `sourceChangingRef.current` et
          `hasStartedRef.current`. Muter une ref ne re-rend rien : au montage du
          lecteur elles valaient encore `false`, la condition était fausse, et
          l'utilisateur voyait un ÉCRAN NOIR entre la bannière de la page et la
          première image. Tout se lit désormais dans l'état. */}
      {!showPlayButton && (hasStarted ? (
        // Buffering EN COURS de lecture (réseau qui cale) : spinner discret.
        loading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* `spinner-lecture` n'habille rien ici : c'est la prise que le
                téléviseur utilise pour l'agrandir, quarante-huit pixels étant
                illisibles à trois mètres. Le web garde sa taille. */}
            <div className="spinner-lecture h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          </div>
        )
      ) : (
        // Chargement INITIAL du média : bannière (backdrop) + barre de chargement.
        // Tenue sans interruption du montage jusqu'à la première image.
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden bg-[#0a0a12]" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(var(--brand-rgb),0.20),transparent_60%)]" />
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
            if (v) { v.muted = false; v.play().then(() => { setShowPlayButton(false); setPolicyMuted(false); }).catch(() => {}); }
          }}>
          <div className="flex flex-col items-center gap-3">
            <svg className="h-20 w-20 text-white/90" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <span className="text-sm text-white/70">{t("player:pressToPlay")}</span>
          </div>
        </div>
      )}

      {policyMuted && playing && !showPlayButton && (
        <button onClick={(e) => { e.stopPropagation(); userInteractedRef.current = true; const v = videoRef.current; if (v) { v.muted = false; setPolicyMuted(false); } }}
          className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/80 ring-1 ring-white/20 backdrop-blur-sm transition-all hover:bg-black/80">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
          {t("player:pressForSound")}
        </button>
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
      />
    </>
  );
}
