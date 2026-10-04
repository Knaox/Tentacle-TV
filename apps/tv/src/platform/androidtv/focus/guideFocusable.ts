/**
 * Android TV — ce qu'un guide de focus sans cible déclare (`focusable` de
 * `TVFocusGuideView`) : RIEN. Sur Android, `focusable={false}` devient
 * `tvFocusable={false}`, qui BLOQUE tous les descendants
 * (`FOCUS_BLOCK_DESCENDANTS`) : le contenu du groupe deviendrait
 * inatteignable. Et un guide sans destination ni `autoFocus` n'y est pas un
 * guide (`ReactViewGroup.isTVFocusGuide`) : il ne capte rien. Le piège que
 * la variante tvOS évite (un guide vide sélectionnable) n'existe pas ici.
 */
export function guideFocusable(_hasTarget: boolean): false | undefined {
  return undefined;
}
