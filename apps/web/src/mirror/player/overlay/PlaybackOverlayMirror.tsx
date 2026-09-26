import { useTranslation } from "react-i18next";
import { useEndCardRating, type PlaybackOverlayResult } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { NextEpisodeFullscreen } from "./NextEpisodeFullscreen";
import { SkipButton } from "./SkipButton";
import { UpNextCard } from "./UpNextCard";

interface Props {
  playback: PlaybackOverlayResult;
  nextEpisode: MediaItem | null;
  /** Média EN COURS — la notation de l'affiche de fin s'y adosse. */
  currentItem?: MediaItem | null;
  /** L'habillage est à l'écran — la carte de coin s'écarte. */
  controlsVisible: boolean;
}

/**
 * Le RENDU de l'arbitre partagé — `PlaybackOverlayMobile` de l'app. Aucune
 * décision ici : trois surfaces, jamais deux à la fois — la pilule de saut
 * (ou « épisode suivant »), la carte de coin pendant le générique, l'affiche
 * plein écran à la vraie fin. Le `key` de la pilule porte le type de passage :
 * passer d'intro à générique relance son balayage à zéro.
 */
export function PlaybackOverlayMirror({ playback, nextEpisode, currentItem, controlsVisible }: Props) {
  const { t } = useTranslation("player");
  // AVANT les retours anticipés (règle des hooks).
  const endCardRating = useEndCardRating(currentItem ?? null);
  const { overlay, countdownTotals } = playback;

  if (overlay.kind === "skip") {
    const count = overlay.countdownSeconds;
    return (
      <SkipButton
        key={overlay.segmentType}
        label={count === null ? t(`player:${overlay.labelKey}`) : t(`player:${overlay.labelKey}In`, { seconds: count })}
        countdownTotalMs={count === null ? null : countdownTotals.skipMs}
        onPress={playback.skipNow}
        onDismiss={overlay.dismissible ? playback.dismissOverlay : undefined}
      />
    );
  }

  if (overlay.kind === "nextButton") {
    return (
      <SkipButton
        label={t("player:goToNextEpisode")}
        countdownTotalMs={null}
        onPress={playback.playNow}
        onDismiss={overlay.dismissible ? playback.dismissOverlay : undefined}
      />
    );
  }

  if (overlay.kind === "nextCard" && nextEpisode) {
    if (!overlay.final) {
      return (
        <UpNextCard
          nextEpisode={nextEpisode}
          countdownSeconds={overlay.countdownSeconds}
          countdownTotalMs={countdownTotals.nextMs}
          controlsVisible={controlsVisible}
          onPlay={playback.playNow}
          onDismiss={playback.dismissOverlay}
        />
      );
    }
    return (
      <NextEpisodeFullscreen
        nextEpisode={nextEpisode}
        countdownSeconds={overlay.countdownSeconds}
        countdownTotalMs={countdownTotals.nextMs}
        onPlay={playback.playNow}
        onDismiss={playback.dismissOverlay}
        rating={endCardRating}
        onRatingEngage={playback.cancelNextCountdown}
      />
    );
  }

  return null;
}
