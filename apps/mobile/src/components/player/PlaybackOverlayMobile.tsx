import { useTranslation } from "react-i18next";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { SkipButton } from "./SkipButton";
import { AutoPlayOverlay } from "./AutoPlayOverlay";

interface Props {
  overlay: PlayerOverlay;
  countdownTotals: { skipMs: number; nextMs: number };
  nextEpisode?: MediaItem | null;
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
 * par la coquille partagée. Deux surfaces, jamais les deux à la fois : la
 * pilule de saut, et la carte « à suivre ».
 *
 * La carte sert AUSSI d'écran de fin (`final`) : le mobile n'a qu'une surface
 * plein écran pour la suite, et elle dit déjà tout ce que l'écran de fin du web
 * dit — vignette, titre, décompte, « lire » et « fermer ».
 *
 * Le `key` du bouton porte le type de passage : changer d'intro à générique
 * remonte la pilule, donc relance sa glissière à zéro. Sans lui, la seconde
 * hériterait de la course de la première.
 */
export function PlaybackOverlayMobile({
  overlay, countdownTotals, nextEpisode, onSkip, onDismiss, onPlayNow, bottom, right,
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
        onDismiss={onDismiss}
        bottom={bottom}
        right={right}
      />
    );
  }

  // La pilule « aller à l'épisode suivant » : MÊME bouton que les sauts, sans
  // croix — elle n'apparaît qu'avec l'habillage, elle ne s'impose donc jamais.
  // C'est elle qui garde l'accès à la suite pendant une scène post-générique.
  if (overlay.kind === "nextButton") {
    return (
      <SkipButton
        label={t("player:goToNextEpisode")}
        countdownTotalMs={null}
        onPress={onPlayNow}
        bottom={bottom}
        right={right}
      />
    );
  }

  if (overlay.kind === "nextCard" && nextEpisode) {
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
