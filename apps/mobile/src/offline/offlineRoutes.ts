/**
 * Quelles routes exigent le serveur ?
 *
 * Hors ligne, l'application ne montre que ce qui vit sur l'appareil : le
 * catalogue local (onglet Accueil), le profil réduit, le lecteur, les réglages
 * d'appareil, À propos et les crédits. Tout le reste — fiches, bibliothèques,
 * extensions, recherche, listes, réglages de compte — parle au serveur et n'a
 * rien à afficher : la garde de route renvoie au catalogue.
 *
 * Les segments sont ceux d'expo-router (`useSegments()`) :
 * `["(tabs)", "for-you"]`, `["media", "[itemId]"]`, `["settings", "data"]`…
 */

const SERVER_ONLY_ROOTS: ReadonlySet<string> = new Set([
  "media", "library", "plugin", "watchlist", "favorites", "search", "pair-tv", "support",
]);

const SERVER_ONLY_TABS: ReadonlySet<string> = new Set(["for-you", "libraries", "extensions"]);

const SERVER_ONLY_SETTINGS: ReadonlySet<string> = new Set([
  "password", "notifications", "devices", "invites", "personalization",
]);

/** Vrai si la route courante n'a rien à montrer sans serveur. */
export function isServerOnlyRoute(segments: readonly string[]): boolean {
  const [root, second] = segments;
  if (root === undefined) return false;
  if (SERVER_ONLY_ROOTS.has(root)) return true;
  if (root === "(tabs)") return second !== undefined && SERVER_ONLY_TABS.has(second);
  if (root === "settings") return second !== undefined && SERVER_ONLY_SETTINGS.has(second);
  return false;
}
