/**
 * Canal de distribution du build, injecté à la compilation.
 *
 * Dans son propre fichier, SANS aucune dépendance : `desktop/capabilities.ts` en
 * a besoin pour savoir si le shell sait mettre l'app à jour, et il ne peut pas
 * l'importer depuis `hooks/mpvRuntime.ts` — celui-ci importe `desktop/detect.ts`,
 * le cycle serait immédiat. `mpvRuntime` le ré-exporte, si bien que rien ne
 * change pour ses appelants.
 */

/**
 * Build distribué par le Mac App Store.
 *
 * Conséquence : l'application ne s'installe pas elle-même. Elle DÉTECTE une
 * version plus récente (un manifeste HTTP) et ouvre la fiche de l'App Store,
 * qui fait le reste. Aucune commande native n'est donc requise pour ce canal —
 * seulement une ouverture d'URL, que les deux coquilles savent faire.
 */
export function isAppStoreBuild(): boolean {
  return typeof __DIST_CHANNEL__ !== "undefined" && __DIST_CHANNEL__ === "appstore";
}
