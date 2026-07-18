import type { MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { LoadingBar } from "./PlayerLoadingScreen";
import { NextEpisodeOverlay } from "../NextEpisodeOverlay";
import { NextEpisodeFullscreen } from "./NextEpisodeFullscreen";
import type { SegmentTimestamps } from "@tentacle-tv/shared";

interface DesktopPlayerOverlaysProps {
  showLoadingOverlay: boolean;
  buffering: boolean;
  posterUrl?: string;
  showSkipIntro: boolean | null | undefined;
  showSkipCredits: boolean | null | undefined;
  introSegment?: SegmentTimestamps | null;
  creditsSegment?: SegmentTimestamps | null;
  isDirectPlay: boolean;
  effectiveMpvOffset: MutableRefObject<number>;
  hasNextEpisode?: boolean;
  autoPlayCountdown: number | null;
  autoPlaySource: "credits" | "eof" | null;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextSeriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
  seek: (pos: number) => Promise<void>;
  onNextEpisode?: () => void;
  cancelAutoPlay: () => void;
  onAutoNextDismiss?: () => void;
}

/**
 * Overlays du player desktop : chargement (bannière + LoadingBar), spinner de
 * buffering, boutons skip intro/générique, et les deux écrans « épisode
 * suivant » (bannière crédits / affiche pleine EOF). Extraction mécanique.
 *
 * Tout est posé sur la vidéo → text-white/bg-black volontairement en dur,
 * identiques dans les deux thèmes clair/sombre.
 */
export function DesktopPlayerOverlays({
  showLoadingOverlay, buffering, posterUrl,
  showSkipIntro, showSkipCredits, introSegment, creditsSegment,
  isDirectPlay, effectiveMpvOffset, hasNextEpisode,
  autoPlayCountdown, autoPlaySource,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
  seek, onNextEpisode, cancelAutoPlay, onAutoNextDismiss,
}: DesktopPlayerOverlaysProps) {
  const { t } = useTranslation("player");

  return (
    <>
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

      {/* Skip intro / credits buttons */}
      {showSkipIntro && introSegment && (
        <button onClick={() => seek(isDirectPlay ? introSegment.end : Math.max(0, introSegment.end - effectiveMpvOffset.current))}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          {t("player:skipIntro")}
        </button>
      )}
      {showSkipCredits && creditsSegment && !autoPlayCountdown && (
        <button onClick={() => { if (hasNextEpisode) onNextEpisode?.(); else seek(isDirectPlay ? creditsSegment.end : Math.max(0, creditsSegment.end - effectiveMpvOffset.current)); }}
          className="absolute bottom-28 right-6 z-20 rounded-lg border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20">
          {hasNextEpisode ? t("player:nextEpisodeLabel") : t("player:skipCredits")}
        </button>
      )}

      <AnimatePresence>
        {autoPlayCountdown !== null && autoPlaySource === "credits" && (
          <NextEpisodeOverlay countdown={autoPlayCountdown} episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription} episodeImageUrl={nextEpisodeImageUrl}
            onPlayNow={() => onNextEpisode?.()}
            onDismiss={() => { cancelAutoPlay(); onAutoNextDismiss?.(); }} />
        )}
        {autoPlayCountdown !== null && autoPlaySource === "eof" && (
          <NextEpisodeFullscreen countdown={autoPlayCountdown} episodeTitle={nextEpisodeTitle}
            episodeDescription={nextEpisodeDescription} seriesBackdropUrl={nextSeriesBackdropUrl}
            episodeThumbUrl={nextEpisodeThumbUrl}
            onPlayNow={() => onNextEpisode?.()}
            onDismiss={() => { cancelAutoPlay(); onAutoNextDismiss?.(); }} />
        )}
      </AnimatePresence>
    </>
  );
}
