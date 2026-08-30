/**
 * Overlays du lecteur de bureau : chargement (bannière + LoadingBar), spinner
 * de buffering, et la projection de l'ARBITRE (`PlaybackOverlay` : bouton de
 * saut blanc, carte « à suivre », affiche de fin). Plus aucune décision ici —
 * l'exclusion mutuelle, les priorités et les décomptes viennent de la
 * coquille partagée.
 *
 * Tout est posé sur la vidéo → text-white/bg-black volontairement en dur,
 * identiques dans les deux thèmes clair/sombre.
 *
 * Et donc PAS de `backdrop-filter` sur les boutons de saut. mpv dessine hors
 * du moteur web — fenêtre native sous la surface de Chromium sur Windows,
 * couche GL sous la webview sur macOS et Linux : le moteur ne voit jamais
 * l'image du film et ne peut pas la flouter. `NextEpisodeFullscreen`, en
 * revanche, garde le sien : il est posé sur la bannière de la série, du HTML.
 */

import type { PlayerOverlay } from "@tentacle-tv/shared";
import { LoadingBar } from "./PlayerLoadingScreen";
import { PlaybackOverlay } from "./PlaybackOverlay";

interface DesktopPlayerOverlaysProps {
  showLoadingOverlay: boolean;
  buffering: boolean;
  /** Réserve mpv en secondes (`demuxer-cache-duration`) — affichée en debug. */
  buffered: number;
  posterUrl?: string;
  overlay: PlayerOverlay;
  countdownTotals: { skipMs: number; nextMs: number };
  onSkip: () => void;
  onDismissOverlay: () => void;
  onPlayNow: () => void;
  /** La barre de contrôles est-elle à l'écran ? */
  controlsVisible: boolean;
  /** Un panneau du lecteur (pistes, épisodes) est ouvert : pilules effacées. */
  panelOpen: boolean;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextSeriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
}

export function DesktopPlayerOverlays({
  showLoadingOverlay, buffering, buffered, posterUrl,
  overlay, countdownTotals, onSkip, onDismissOverlay, onPlayNow, controlsVisible, panelOpen,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
}: DesktopPlayerOverlaysProps) {
  return (
    <>
      {/* Réserve mpv, paquet instrumenté seulement — le seul chiffre qui dise
          si l'image est partie avec de quoi tenir. */}
      {(import.meta.env.DEV || __PLAYER_DEBUG__) && (
        <div className="pointer-events-none absolute left-4 top-4 z-30 rounded bg-black/70 px-2 py-1 font-mono text-[11px] text-white/90">
          cache {buffered.toFixed(1)} s{buffering ? " · attente" : ""}
        </div>
      )}

      {/* Loading overlay — initial load + source changes (quality/audio) :
          bannière (backdrop) + barre de chargement, en continuité avec
          PlayerLoadingScreen affiché avant le montage du player. */}
      {showLoadingOverlay && (
        <div className="pointer-events-none absolute inset-0 z-[5]">
          {posterUrl && <img src={posterUrl} className="h-full w-full object-cover" alt="" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" />
          <div className="absolute inset-x-0 bottom-0 px-8 pb-14 md:px-16 md:pb-20">
            <LoadingBar />
          </div>
        </div>
      )}

      {/* Buffering spinner (during playback — seeking, network stall) */}
      {buffering && !showLoadingOverlay && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        </div>
      )}

      <PlaybackOverlay
        overlay={overlay}
        countdownTotals={countdownTotals}
        onSkip={onSkip}
        onDismiss={onDismissOverlay}
        onPlayNow={onPlayNow}
        layer="z-20"
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
