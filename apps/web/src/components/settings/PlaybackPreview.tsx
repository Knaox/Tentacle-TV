/**
 * L'aperçu d'UN passage : le vrai bouton du lecteur, sous son propre réglage.
 *
 * # Pourquoi un par ligne, et pas un seul en tête
 *
 * Il y en avait un seul, qui suivait la ligne qu'on touchait. Ça demandait de
 * comprendre qu'il la suivait — et de faire le lien entre un cadre en haut du
 * groupe et un réglage plus bas. Chaque passage a désormais le sien, juste sous
 * ses trois choix : il n'y a plus rien à relier.
 *
 * # C'est le VRAI bouton
 *
 * `SkipSegmentButton` est monté tel quel — même pilule, même croix, même
 * balayage de décompte, mêmes libellés que dans le lecteur. Pas un sosie : un
 * sosie dériverait au premier changement, et l'aperçu mentirait sans que rien
 * ne le signale. Le cadre fait 360 px pour que la pilule la plus longue y tienne
 * à sa taille réelle, sans transformée d'échelle qui rendrait le texte illisible.
 */

import { useTranslation } from "react-i18next";
import type { SegmentSettings, SkipLabelKey } from "@tentacle-tv/shared";
import { SkipSegmentButton } from "../player/SkipSegmentButton";
import { PreviewStage } from "./PreviewStage";
import { usePreviewCountdown } from "./usePreviewCountdown";

interface PlaybackPreviewProps {
  settings: SegmentSettings;
  /** Le libellé du bouton, celui du passage concerné. */
  labelKey: SkipLabelKey;
}

/** La phrase qui dit ce qui va se passer — et le seul canal quand le cadre est
 *  vide, ou pour un lecteur d'écran (le cadre, lui, est `inert`). */
function captionKey(settings: SegmentSettings): string {
  if (settings.action === "off") return "previewCaptionOff";
  if (settings.action === "button") return "previewCaptionButton";
  return settings.countdownVisible ? "previewCaptionAuto" : "previewCaptionAutoSilent";
}

export function PlaybackPreview({ settings, labelKey }: PlaybackPreviewProps) {
  const { t } = useTranslation("preferences");
  const counting = settings.action === "auto" && settings.countdownVisible;
  const { seconds, cycle, ref } = usePreviewCountdown(counting, settings.autoDelayMs);

  return (
    <PreviewStage
      stageRef={ref}
      caption={t(captionKey(settings), { seconds: Math.round(settings.autoDelayMs / 100) / 10 })}
    >
      {settings.action !== "off" && (
        <SkipSegmentButton
          // Le tour de décompte sert de clé : la pilule se remonte, et son
          // balayage rejoue depuis le début.
          key={`${labelKey}-${String(cycle)}`}
          labelKey={labelKey}
          countdownSeconds={counting ? seconds : null}
          countdownTotalMs={settings.autoDelayMs}
          onSkip={() => undefined}
          onDismiss={() => undefined}
          layer="z-10"
        />
      )}
    </PreviewStage>
  );
}
