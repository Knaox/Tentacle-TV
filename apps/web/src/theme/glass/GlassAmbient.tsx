/**
 * Le FOND AMBIANT du verre (maquette du 26/10) : de grandes taches de nos
 * couleurs — violet → rose — sur l'encre de la page, ce qui donne au verre
 * quelque chose à réfracter. À monter UNE fois par écran (la coquille, la
 * fiche, les réglages), sous le contenu : `position: fixed` (défaut) ou
 * `absolute` dans un parent positionné (une scène à elle).
 *
 * `image` : l'adresse d'une affiche, d'une bannière, d'une pochette — ses deux
 * teintes (gauche, droite) prennent la place de deux taches, bornées pour que
 * le texte des verres reste lisible (`ambientTint.ts`). Sans couleur, refusée
 * ou pas encore lue : nos couleurs.
 *
 * Coût : des dégradés radiaux sur UNE couche, peinte une fois — jamais animée,
 * aucun `filter: blur`. Hors du mode natif, RIEN n'est rendu (rendu d'avant au
 * pixel près) ; aucun pixel n'est lu.
 */

import { memo, type CSSProperties } from "react";
import { useLiquidGlassMode } from "../useLiquidGlass";
import { useImageTint } from "./useImageTint";

export interface GlassAmbientProps {
  /** L'image dont les teintes colorent le fond (affiche, bannière, pochette). */
  image?: string | null;
  /** Deux teintes déjà connues (« r, g, b »), à la place d'une image. */
  tints?: readonly [string, string] | null;
  /** `fixed` (défaut) : derrière toute la fenêtre ; `absolute` : dans son parent positionné. */
  position?: "fixed" | "absolute";
  className?: string;
}

export const GlassAmbient = memo(function GlassAmbient({ image = null, tints = null, position = "fixed", className }: GlassAmbientProps) {
  const native = useLiquidGlassMode() === "native";
  const read = useImageTint(tints ? null : image);
  if (!native) return null;
  const pair = tints ?? read;
  const style = pair ? ({ "--lg-ambient-tint-1": pair[0], "--lg-ambient-tint-2": pair[1] } as CSSProperties) : undefined;
  return (
    <div
      aria-hidden
      className={className ? `lg-ambient ${className}` : "lg-ambient"}
      data-lg-ambient={position === "absolute" ? "absolute" : undefined}
      data-lg-ambient-tint={pair ? "" : undefined}
      style={style}
    />
  );
});
