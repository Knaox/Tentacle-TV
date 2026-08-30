/**
 * L'aperçu de l'affiche de fin : la VRAIE `NextEpisodeFullscreen`.
 *
 * Même invariant que les autres aperçus — le composant du LECTEUR, monté tel
 * quel, jamais un sosie qui dériverait au premier changement. L'affiche est
 * plein viewport : on la pose sur un canevas à sa taille naturelle (960 × 540,
 * le 16:9 du cadre) et une transformée mesurée la ramène dans le cadre — même
 * mécanique que la fiche « à suivre », pour la même raison.
 *
 * ⚠️ PAS d'`AnimatePresence`, et la `key` du composant suit le CYCLE de
 * l'aperçu, jamais les secondes : c'est le remontage entier qui rejoue
 * l'entrée et le balayage, le `Sweep` interne garde sa propre règle.
 *
 * Aucune image téléchargée : sans bannière, l'affiche peint son repli sombre
 * — ses dégradés font le reste.
 */

import { useTranslation } from "react-i18next";
import type { NextEpisodeSettings } from "@tentacle-tv/shared";
import { NextEpisodeFullscreen } from "../player/NextEpisodeFullscreen";
import { PreviewStage } from "./PreviewStage";
import { useFitScale } from "./useFitScale";
import { usePreviewCountdown } from "./usePreviewCountdown";

/** Ce que la phrase doit dire, selon la combinaison des réglages. */
function captionKey(next: NextEpisodeSettings): string {
  if (!next.nextFinalCard) return "previewNextFinalCaptionOff";
  if (!next.nextCountdown) return "previewNextFinalCaptionCard";
  return next.nextAutoPlay ? "previewNextFinalCaptionAuto" : "previewNextFinalCaptionCountdown";
}

/** Le canevas naturel de l'affiche : le 16:9 du cadre, en pixels entiers. */
const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 540;

export function NextFinalCardPreview({ next }: { next: NextEpisodeSettings }) {
  const { t } = useTranslation("preferences");
  const counting = next.nextFinalCard && next.nextCountdown;
  const { seconds, cycle, ref, element } = usePreviewCountdown(counting, next.nextCountdownMs);
  const scale = useFitScale(element, STAGE_WIDTH);

  return (
    <PreviewStage
      width="card"
      stageRef={ref}
      caption={t(captionKey(next), { seconds: Math.round(next.nextCountdownMs / 100) / 10 })}
    >
      {next.nextFinalCard && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            transform: `scale(${String(scale)})`,
          }}
        >
          <NextEpisodeFullscreen
            key={String(cycle)}
            countdown={counting ? seconds : null}
            totalSeconds={next.nextCountdownMs / 1000}
            episodeLabel={t("previewNextEpisodeLabel")}
            episodeTitle={t("previewNextEpisodeTitle")}
            episodeDescription={t("previewNextFinalSynopsis")}
            onPlayNow={() => undefined}
            onDismiss={() => undefined}
          />
        </div>
      )}
    </PreviewStage>
  );
}
