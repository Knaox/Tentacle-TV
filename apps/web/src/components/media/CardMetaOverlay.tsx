import { useEffect, useMemo, useState } from "react";
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

  // Mode « mount » : l'appelant ne nous monte que pendant le survol.
  //
  // Pourquoi : chaque pastille porte un `backdrop-filter` (MetaChips) — deux à
  // quatre par carte, plus d'une centaine de cartes sur l'accueil. Rester monté
  // à `opacity: 0` ne libère RIEN sous WebKit : la couche composée subsiste et
  // son flou d'arrière-plan est recalculé, pour un voile que personne ne voit
  // au repos. Chromium les élide bien plus agressivement — c'est une bonne part
  // de l'écart de fluidité constaté entre macOS et Windows.
  //
  // La classe `group-hover/card:opacity-100` ne peut plus produire le fondu
  // dans ce mode, puisque le nœud naît déjà survolé : on le rejoue nous-mêmes,
  // une image après le montage, pour que l'état à opacité nulle soit bien peint
  // avant la bascule. Même durée, même courbe qu'avant.
  const [shown, setShown] = useState(reveal !== "mount");
  useEffect(() => {
    if (reveal !== "mount") return;
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [reveal]);

  const showQuality = compact
    ? quality.resolution === "4K" ||
      quality.isDolbyVision ||
      quality.isDolbyAtmos ||
      quality.isHDR ||
      Boolean(quality.resolution)
    : hasQualityChips(quality);
  const labels = quality.audioLabels.slice(0, compact ? 2 : 3);

  if (!showQuality && labels.length === 0) return null;

  const fade = "transition-opacity duration-200 ease-out motion-reduce:transition-none";
  const revealClass =
    reveal === "hover"
      ? `${fade} opacity-0 group-hover/card:opacity-100`
      : reveal === "mount"
        ? `${fade} ${shown ? "opacity-100" : "opacity-0"}`
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
