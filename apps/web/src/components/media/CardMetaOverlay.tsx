import { useMemo } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { extractMediaQuality } from "../../lib/mediaQuality";
import { LanguagePill, QualityChips, hasQualityChips } from "./MetaChips";

interface Props {
  item: MediaItem;
  /**
   * • "full" (défaut) — résolution + VISION/HDR + ATMOS + pastille langues
   *   (jusqu'à 3 tokens). Pour les landscape (EpisodeCard) qui ont la largeur.
   * • "compact" — UN seul chip qualité dominant + pastille langues (2 tokens).
   *   Pour les portraits étroits (PosterCard).
   */
  density?: "full" | "compact";
  /**
   * • "always" (défaut) — méta visible en permanence (grilles, listes, fiche
   *   Detail). Le nouveau style étant discret, ça ne dénature plus l'affiche.
   * • "hover" — révélé en fondu au survol via `group-hover/card` (cartes du
   *   Home : EpisodeCard / PosterCard, qui portent la classe `group/card`).
   */
  reveal?: "always" | "hover";
}

/**
 * Overlay méta ultra-discret — affiché en TOP-LEFT, révélé en fondu au survol
 * de la carte (`group-hover/card`). Au repos l'affiche reste totalement propre :
 * plus de drapeaux ni de bandeau de badges qui dénaturent l'image.
 *
 * Qualité + langues partagent le même système de chips monochromes
 * (cf. MetaChips), seule source de vérité du style. Le 4K est le seul accent.
 */
export function CardMetaOverlay({ item, density = "full", reveal = "always" }: Props) {
  const quality = useMemo(() => extractMediaQuality(item), [item]);
  const compact = density === "compact";

  const showQuality = compact
    ? quality.resolution === "4K" ||
      quality.isDolbyVision ||
      quality.isDolbyAtmos ||
      quality.isHDR ||
      Boolean(quality.resolution)
    : hasQualityChips(quality);
  const labels = quality.audioLabels.slice(0, compact ? 2 : 3);

  if (!showQuality && labels.length === 0) return null;

  const revealClass =
    reveal === "hover"
      ? "opacity-0 transition-opacity duration-200 ease-out group-hover/card:opacity-100 motion-reduce:transition-none"
      : "";

  return (
    <div
      className={`pointer-events-none absolute left-1.5 top-1.5 z-10 flex flex-wrap items-center gap-1 ${revealClass}`}
    >
      {showQuality && <QualityChips quality={quality} density={density} />}
      <LanguagePill labels={labels} max={compact ? 2 : 3} />
    </div>
  );
}
