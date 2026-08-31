import { useTranslation } from "react-i18next";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { SkipButton } from "./SkipButton";
import { AutoPlayOverlay } from "./AutoPlayOverlay";
import { UpNextCardMobile } from "./UpNextCardMobile";

interface Props {
  overlay: PlayerOverlay;
  countdownTotals: { skipMs: number; nextMs: number };
  nextEpisode?: MediaItem | null;
  /** L'habillage du lecteur est à l'écran — la carte de coin s'écarte. */
  controlsVisible: boolean;
  /** Saut manuel — l'automatique, lui, vit dans la coquille partagée. */
  onSkip: () => void;
  onDismiss: () => void;
  onPlayNow: () => void;
  bottom: number;
  right: number;
}

/**
 * Le RENDU de l'arbitre sur mobile — la projection de `PlayerOverlay`.
 *
 * Aucune décision ici : qui s'affiche, quand, et avec quel décompte est tranché
 * par la coquille partagée. Trois surfaces, jamais deux à la fois — la même
 * partition que le web (`PlaybackOverlay.tsx`) :
 *  - la pilule de saut ;
 *  - la carte « à suivre » DE COIN pendant le générique (`final: false`) —
 *    la vidéo reste visible ;
 *  - l'affiche plein écran à la vraie fin (`final: true`).
 *
 * Le `key` du bouton porte le type de passage : changer d'intro à générique
 * remonte la pilule, donc relance sa glissière à zéro. Sans lui, la seconde
 * hériterait de la course de la première.
 */
export function PlaybackOverlayMobile({
  overlay, countdownTotals, nextEpisode, controlsVisible,
  onSkip, onDismiss, onPlayNow, bottom, right,
}: Props) {
  const { t } = useTranslation("player");

  if (overlay.kind === "skip") {
    const count = overlay.countdownSeconds;
    return (
      <SkipButton
        key={overlay.segmentType}
        label={
          count === null
            ? t(`player:${overlay.labelKey}`)
            : t(`player:${overlay.labelKey}In`, { seconds: count })
        }
        countdownTotalMs={count === null ? null : countdownTotals.skipMs}
        onPress={onSkip}
        // En sourdine, la croix n'a plus d'office : le bouton n'est déjà plus
        // sur l'image, il n'existe que le temps de l'habillage.
        onDismiss={overlay.dismissible ? onDismiss : undefined}
        bottom={bottom}
        right={right}
      />
    );
  }

  // La pilule « aller à l'épisode suivant » : MÊME bouton que les sauts, et même
  // règle — elle se montre tant qu'on ne l'a pas refusée. C'est elle qui garde
  // l'accès à la suite pendant une scène post-générique.
  if (overlay.kind === "nextButton") {
    return (
      <SkipButton
        label={t("player:goToNextEpisode")}
        countdownTotalMs={null}
        onPress={onPlayNow}
        onDismiss={overlay.dismissible ? onDismiss : undefined}
        bottom={bottom}
        right={right}
      />
    );
  }

  if (overlay.kind === "nextCard" && nextEpisode) {
    // Générique : carte de coin, la vidéo reste visible. Vraie fin : plein
    // écran. Même partition que `PlaybackOverlay.tsx` web.
    if (!overlay.final) {
      return (
        <UpNextCardMobile
          nextEpisode={nextEpisode}
          countdownSeconds={overlay.countdownSeconds}
          countdownTotalMs={countdownTotals.nextMs}
          controlsVisible={controlsVisible}
          onPlay={onPlayNow}
          onDismiss={onDismiss}
        />
      );
    }
    return (
      <AutoPlayOverlay
        nextEpisode={nextEpisode}
        countdown={overlay.countdownSeconds ?? 0}
        totalSeconds={countdownTotals.nextMs / 1000}
        onPlay={onPlayNow}
        onDismiss={onDismiss}
      />
    );
  }

  return null;
}
