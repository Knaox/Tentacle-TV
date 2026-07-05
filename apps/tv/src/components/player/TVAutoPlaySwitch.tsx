import type { MediaItem } from "@tentacle-tv/shared";
import { TVAutoPlayOverlay } from "../TVAutoPlayOverlay";
import { TVNextEpisodeFullscreen } from "../TVNextEpisodeFullscreen";

/** Sous-ensemble de l'état useAutoPlay consommé par la vue (structurel). */
export interface AutoPlayCtx {
  countdown: number | null;
  /** "credits" = bannière ; "eof" = écran plein de fin (parité desktop). */
  source: "credits" | "eof" | null;
  nextEpisode: MediaItem | null;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextEpisodeOverview?: string;
  seriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
  navigateToNextEpisode: () => void;
  startAutoPlay: () => void;
  cancelAutoPlay: () => void;
}

/**
 * Aiguillage des surfaces « épisode suivant » (extrait de TVPlayerView, budget
 * 300 lignes) : pendant les crédits → bannière discrète (TVAutoPlayOverlay) ;
 * à la VRAIE fin (source "eof") → écran plein « épisode suivant » (parité
 * NextEpisodeFullscreen desktop).
 *
 * `onEofDismiss` : dismiss de l'écran de FIN — à la vraie fin, il n'y a plus rien
 * à regarder : le caller route vers la fiche média (avant : cancelAutoPlay seul →
 * player gelé sur la dernière frame, spinner infini). La bannière crédits garde
 * cancelAutoPlay (le contenu joue encore).
 */
export function TVAutoPlaySwitch({ autoPlay, active, onEofDismiss }: {
  autoPlay: AutoPlayCtx; active: boolean; onEofDismiss?: () => void;
}) {
  const episodeLabel = autoPlay.nextEpisode?.ParentIndexNumber != null && autoPlay.nextEpisode?.IndexNumber != null
    ? `S${String(autoPlay.nextEpisode.ParentIndexNumber).padStart(2, "0")}E${String(autoPlay.nextEpisode.IndexNumber).padStart(2, "0")}`
    : undefined;

  if (autoPlay.source === "eof" && autoPlay.countdown !== null) {
    return (
      <TVNextEpisodeFullscreen
        countdown={autoPlay.countdown}
        episodeLabel={episodeLabel}
        episodeTitle={autoPlay.nextEpisode?.Name ?? undefined}
        episodeDescription={autoPlay.nextEpisodeOverview ?? autoPlay.nextEpisodeDescription}
        seriesBackdropUrl={autoPlay.seriesBackdropUrl}
        episodeThumbUrl={autoPlay.nextEpisodeThumbUrl}
        onPlayNow={autoPlay.navigateToNextEpisode} onDismiss={onEofDismiss ?? autoPlay.cancelAutoPlay}
      />
    );
  }
  if (!active) return null;
  return (
    <TVAutoPlayOverlay
      countdown={autoPlay.countdown!} episodeTitle={autoPlay.nextEpisodeTitle}
      episodeLabel={episodeLabel}
      episodeDescription={autoPlay.nextEpisodeDescription}
      episodeImageUrl={autoPlay.nextEpisodeImageUrl}
      onPlayNow={autoPlay.navigateToNextEpisode} onDismiss={autoPlay.cancelAutoPlay}
    />
  );
}
