/**
 * Octave (mobile) — la REDIRECTION du lancement en Octave, machine PURE
 * (testée sans React Native). Elle part UNE seule fois, impérativement, de la
 * racine (`OctaveLaunchRedirect`) ; jusqu'à ce qu'elle soit TRANCHÉE, la
 * coquille de Tentacle ne se peint pas (ni accueil des films, ni ses requêtes).
 *
 * Tranchée : Octave est atteint (sa coquille est montée), on en est sorti (la
 * porte a rendu la main à Tentacle, ou l'utilisateur), ou elle n'a pas lieu
 * (lien profond, session absente). Plus jamais rejouée ensuite.
 *
 * Pourquoi pas un `<Redirect>` dans la coquille de Tentacle : expo-router y
 * relance `router.replace` à CHAQUE rendu tant que l'écran a le focus — et la
 * porte d'Octave qui rendait la main à Tentacle relançait la redirection :
 * « Maximum update depth exceeded » au relancement en Octave (28/10).
 */

export interface LaunchRedirect {
  /** La page gardée où arriver ; null : pas de lancement en Octave. */
  path: string | null;
  /** La redirection est partie (une fois). */
  taken: boolean;
  settled: boolean;
}

export const NO_LAUNCH_REDIRECT: LaunchRedirect = { path: null, taken: false, settled: true };

export function launchRedirectOf(inOctave: boolean, path: string | null): LaunchRedirect {
  return inOctave && path ? { path, taken: false, settled: false } : NO_LAUNCH_REDIRECT;
}

/** La coquille de Tentacle attend-elle (rien de peint) ? */
export function launchRedirectPending(redirect: LaunchRedirect): boolean {
  return redirect.path !== null && !redirect.settled;
}

/**
 * Où aller, UNE fois. `atEntry` : l'app est sur son entrée par défaut (`/`) —
 * un lien profond (notification) garde sa page, la redirection est tranchée sans partir.
 */
export function takeLaunchRedirect(redirect: LaunchRedirect, atEntry: boolean): { next: LaunchRedirect; go: string | null } {
  if (redirect.taken || redirect.settled || redirect.path === null) return { next: redirect, go: null };
  if (!atEntry) return { next: { ...redirect, taken: true, settled: true }, go: null };
  return { next: { ...redirect, taken: true }, go: redirect.path };
}

/** Octave atteint, ou quitté : tranchée pour de bon. */
export function settleLaunchRedirect(redirect: LaunchRedirect): LaunchRedirect {
  return redirect.settled ? redirect : { ...redirect, taken: true, settled: true };
}
