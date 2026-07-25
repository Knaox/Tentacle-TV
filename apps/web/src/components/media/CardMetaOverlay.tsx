import { useMemo } from "react";
import type { CSSProperties } from "react";
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
   * • "mount" — le composant n'est monté QUE pendant le survol, et joue son
   *   fondu d'entrée lui-même. Seul mode retenu pour le survol : voir plus bas
   *   pourquoi. Un mode "hover" a existé, qui gardait le composant monté et
   *   s'en remettait à `group-hover/card` ; il n'avait de raison d'être que
   *   pour les appelants sans état de survol en React, et il n'en reste aucun.
   */
  reveal?: "always" | "mount";
  /**
   * Cible du fondu en mode "mount", quand l'appelant sait aussi RETARDER le
   * démontage (`useHoverMount`). Fournie, elle rend à l'overlay son fondu de
   * SORTIE — sans elle il disparaît d'un coup, l'élément quittant le DOM avant
   * qu'une transition puisse se jouer.
   */
  shown?: boolean;
}

/**
 * Overlay méta ultra-discret — affiché en TOP-LEFT, révélé en fondu au survol
 * de la carte (`group-hover/card`). Au repos l'affiche reste totalement propre :
 * plus de drapeaux ni de bandeau de badges qui dénaturent l'image.
 *
 * Qualité + langues partagent le même système de chips monochromes
 * (cf. MetaChips), seule source de vérité du style. Le 4K est le seul accent.
 */
export function CardMetaOverlay({ item, density = "full", reveal = "always", shown }: Props) {
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
  //
  // `hover-reveal` plutôt que `fade-in-on-mount` quand l'appelant fournit
  // `shown` : les deux reposent sur `@starting-style` pour l'entrée, mais la
  // première rend AUSSI le fondu de sortie, l'appelant retardant alors le
  // démontage le temps qu'il se joue (`useHoverMount`).
  const revealClass =
    reveal === "mount" ? (shown === undefined ? "fade-in-on-mount" : "hover-reveal") : "";

  return (
    <div
      className={`pointer-events-none absolute left-1.5 top-1.5 z-10 flex flex-wrap items-center gap-1 ${revealClass}`}
      data-shown={shown}
      style={shown === undefined ? undefined : ({ "--reveal-ms": "200ms" } as CSSProperties)}
    >
      {showQuality && <QualityChips quality={quality} density={density} />}
      <LanguagePill labels={labels} max={compact ? 2 : 3} />
    </div>
  );
}
