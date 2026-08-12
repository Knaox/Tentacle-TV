/**
 * Étiquette du raccourci de recherche, adaptée au clavier de l'utilisateur.
 *
 * L'étiquette affichait « Ctrl+K » partout alors que le raccourci accepte
 * `metaKey` depuis toujours : sur Mac, ⌘K fonctionne mais rien ne le dit, et
 * Ctrl+K — la seule combinaison annoncée — n'y est pas le geste naturel.
 *
 * `desktopPlatform()` ne convient pas ici : il renvoie délibérément « web »
 * hors application native, alors que la question ne porte que sur le clavier.
 */
export function isAppleKeyboard(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** « ⌘K » sur les claviers Apple, « Ctrl+K » ailleurs. */
export function searchShortcutLabel(): string {
  return isAppleKeyboard() ? "⌘K" : "Ctrl+K";
}
