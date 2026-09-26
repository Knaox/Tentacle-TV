/**
 * Une page ouverte AVANT une mise à jour du client ne trouve plus ses modules.
 *
 * Chaque build renomme ses morceaux par empreinte et efface les anciens. Un
 * téléviseur resté allumé pendant la mise à jour du serveur garde l'ancien
 * `index.html` en mémoire : le jour où il ouvre une page chargée à la demande
 * (lecteur, bibliothèque, fiche), il demande un fichier qui n'existe plus —
 * l'import échoue et l'écran reste noir jusqu'au redémarrage de l'app (vécu
 * sur la C3 le 26 septembre 2026). Recharger la page ramène la version
 * courante, et la route demandée avec elle.
 *
 * Un seul rechargement par fenêtre de 30 s : si le module manque encore après
 * (réseau coupé, serveur en panne), on laisse l'erreur remonter plutôt que de
 * boucler.
 */

/** Clé traversée par une chaîne — ne jamais renommer (cf. CLAUDE.md). */
const RELOAD_KEY = "tentacle_stale_build_reload";
const MIN_INTERVAL_MS = 30_000;

/** Les messages des moteurs quand un import dynamique échoue. */
const MODULE_LOAD_FAILURES = [
  "Failed to fetch dynamically imported module", // Chromium
  "Importing a module script failed", // WebKit
  "error loading dynamically imported module", // Firefox
];

export function isModuleLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return MODULE_LOAD_FAILURES.some((fragment) => message.includes(fragment));
}

/** Recharge la page si la fenêtre le permet. Renvoie vrai si c'est parti. */
export function reloadForStaleBuild(): boolean {
  let last: number;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
  } catch {
    // Stockage indisponible : sans mémoire, on ne risque pas une boucle.
    return false;
  }
  if (Date.now() - last < MIN_INTERVAL_MS) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Vite annonce l'échec d'un import dynamique par `vite:preloadError`. */
export function installStaleBuildReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForStaleBuild()) event.preventDefault();
  });
}
