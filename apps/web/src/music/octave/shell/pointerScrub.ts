/**
 * Octave — où tombe un clic (ou un doigt) sur une glissière : la fraction de la LARGEUR DU RAIL dessiné, mesurée
 * au pixel près (`getBoundingClientRect`, coordonnées de la fenêtre). Jamais la règle du `<input type="range">`
 * natif, qui rapporte la valeur à la course de SON curseur (largeur moins le curseur invisible) : en fenêtre
 * étroite, un clic tombait jusqu'à une demi-largeur de curseur à côté (lot « fl », 30/10).
 */

export interface RailBox {
  left: number;
  width: number;
}

/** La fraction (0 → 1) sous `clientX` ; 0 sur un rail sans largeur. */
export function pointerRatio(clientX: number, rail: RailBox): number {
  if (!(rail.width > 0) || !Number.isFinite(clientX)) return 0;
  return Math.min(1, Math.max(0, (clientX - rail.left) / rail.width));
}

/** La valeur sous le pointeur, entre `min` et `max` — sans pas : un clic va EXACTEMENT où il tombe. */
export function pointerValue(clientX: number, rail: RailBox, min: number, max: number): number {
  return min + pointerRatio(clientX, rail) * (max - min);
}
