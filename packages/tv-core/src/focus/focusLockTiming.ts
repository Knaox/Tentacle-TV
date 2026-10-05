/**
 * QUAND un verrou de focus (une cible rendue infocalisable pour un temps)
 * peut se poser sur la vue native.
 *
 * Android TV : verrouiller la vue qui A le focus le lui retire, et Android le
 * rend aussitôt depuis la racine. S'il retombe dans un guide de focus dont
 * la destination est CETTE vue, désormais infocalisable, react-native-tvos
 * remonte de la destination à ses ancêtres (`requestFocusViewOrAncestor`),
 * redescend dans le guide, et recommence — jusqu'au débordement de pile :
 * l'app tombait au jumelage (la croix Retour, seule cible du code du relais,
 * reverrouillée à l'étape du succès sous le guide de sa bande). Le verrou
 * d'une cible focalisée attend donc qu'elle perde le focus.
 *
 * Déverrouiller, en revanche, n'attend jamais.
 */
export function focusLockWaitsForBlur(locked: boolean, key: string, focusedKey: string | null): boolean {
  return locked && focusedKey === key;
}
