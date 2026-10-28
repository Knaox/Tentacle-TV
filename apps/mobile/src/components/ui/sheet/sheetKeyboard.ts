/**
 * Règle pure : une feuille du bas qui MONTE avec le clavier (champ et bouton toujours visibles).
 *
 * La feuille vit dans une `Modal` plein écran, posée en bas : le clavier la recouvre. On la soulève de ce que
 * le clavier recouvre VRAIMENT de la modale — jamais deux fois : si le système a déjà rétréci la fenêtre
 * (`adjustResize` d'Android hors bord à bord), la modale mesurée a perdu cette hauteur et il ne reste rien à
 * soulever. Puis ses deux crans se bornent à la place restante au-dessus du clavier, sous la zone sûre du haut.
 */

/** Marge gardée sous la zone sûre du haut quand la feuille monte avec le clavier. */
export const SHEET_KEYBOARD_TOP_GAP = 8;

/**
 * Hauteur que le clavier recouvre, depuis le bas de l'écran. Android la donne SANS la barre de navigation
 * (`ime - systemBars`, `ReactRootView`) alors que la modale, en bord à bord, descend dessous : on la rajoute.
 * Un clavier flottant (iPad) ou absent ne recouvre rien.
 */
export function keyboardCover(os: string, keyboardHeight: number, bottomInset: number): number {
  if (!(keyboardHeight > 1)) return 0;
  return os === "android" ? keyboardHeight + bottomInset : keyboardHeight;
}

/**
 * De combien soulever la feuille : ce que le clavier recouvre, moins ce que la fenêtre a déjà perdu
 * (`restHeight` : la modale sans clavier ; `rootHeight` : la modale maintenant).
 */
export function sheetKeyboardLift(cover: number, restHeight: number, rootHeight: number): number {
  if (cover <= 0) return 0;
  const shrunk = Math.max(0, restHeight - rootHeight);
  return Math.max(0, Math.round(cover - shrunk));
}

/** Les deux crans (en points) bornés à la place au-dessus du clavier ; inchangés sans clavier. */
export function liftedSnapHeights(
  snaps: readonly [number, number],
  rootHeight: number,
  lift: number,
  topInset: number,
): [number, number] {
  if (lift <= 0 || rootHeight <= 0) return [snaps[0], snaps[1]];
  const room = Math.max(0, Math.round(rootHeight - lift - topInset - SHEET_KEYBOARD_TOP_GAP));
  const max = Math.min(snaps[1], room);
  return [Math.min(snaps[0], max), max];
}
