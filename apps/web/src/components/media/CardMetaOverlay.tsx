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
   * • "hover" — le composant reste MONTÉ et c'est `group-hover/card` qui le
   *   révèle en fondu. Pour les appelants qui n'ont pas d'état de survol en
   *   React (CollectionGrid, qui s'en remet entièrement au CSS).
   * • "mount" — le composant n'est monté QUE pendant le survol, et joue son
   *   fondu d'entrée lui-même. À préférer partout où l'appelant connaît déjà
   *   l'état de survol (PosterTile, EpisodeCard) : voir plus bas pourquoi.
   */
  reveal?: "always" | "hover" | "mount";
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

  // Mode « mount » : l'appelant ne nous monte que pendant le survol, parce que
  // chaque pastille porte un `backdrop-filter` (MetaChips) — deux à quatre par
  // carte, plus d'une centaine de cartes sur l'accueil. Rester monté à
  // `opacity: 0` ne libère RIEN sous WebKit : la couche composée subsiste et
  // son flou d'arrière-plan est recalculé, pour un voile que personne ne voit.
  //
  // Le fondu d'entrée est alors joué par `@starting-style` (theme/rendering.css)
  // et non par un aller-retour en `requestAnimationFrame`, qui imposait un
  // second rendu React et une seconde peinture à l'image suivante.
  const revealClass =
    reveal === "hover"
      ? "transition-opacity duration-200 ease-out motion-reduce:transition-none opacity-0 group-hover/card:opacity-100"
      : reveal === "mount"
        ? "fade-in-on-mount"
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
