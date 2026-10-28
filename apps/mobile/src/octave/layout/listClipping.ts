/**
 * Octave (mobile) — le RETRAIT des cellules hors écran d'une liste virtualisée (`removeClippedSubviews`),
 * permis sur Android seulement (`listClipping.test.ts`).
 *
 * Sur iOS, dans la nouvelle architecture (Fabric), une liste qui retire ses cellules hors écran les remonte
 * mal quand ses données changent d'ordre ou de contenu : des cellules restent DÉTACHÉES (une place vide), des
 * vues d'avant restent montées à leur ancienne place (deux légendes l'une sur l'autre). C'est le bogue relevé
 * sur l'accueil (28/10) : « Vos albums du moment » et « Vos artistes du moment » se réordonnent à chaque
 * écoute (accueil relu au retour sur la page), et leurs cartes se superposaient. La fenêtre de la liste
 * (`windowSize`, `initialNumToRender`) suffit à borner ce qui est monté ; sur Android, le retrait reste un
 * gain mesurable (vues natives plus lourdes) et n'a pas ce défaut.
 *
 * Module pur (aucun import de React Native) : l'écran lui passe `Platform.OS`.
 */

export function clipsOffscreenCells(os: string): boolean {
  return os === "android";
}
