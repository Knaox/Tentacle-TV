/**
 * La part REMPLIE d'un curseur, en pourcentage.
 *
 * WebKit et Blink n'exposent aucun pseudo-élément pour le côté bas de la
 * course d'un `input[type=range]` — Firefox a `::-moz-range-progress`, eux
 * n'ont rien. La seule voie portable est donc de peindre le remplissage dans
 * le FOND de la piste et d'en dimensionner la largeur : c'est ce que
 * `--range-fill` fait dans `theme/controls.css`.
 *
 * Cette fonction produit le style en ligne qui la pose. Un seul appelant par
 * curseur, une seule variable — et le rendu redevient le nôtre au lieu de
 * celui de l'agent utilisateur (piste gris clair sur fond noir).
 */

import type { CSSProperties } from "react";

export function rangeFill(value: number, min: number, max: number): CSSProperties {
  const span = max - min;
  const ratio = span > 0 ? (value - min) / span : 0;
  const clamped = Math.min(1, Math.max(0, ratio));
  return { "--range-fill": `${(clamped * 100).toFixed(2)}%` } as CSSProperties;
}
