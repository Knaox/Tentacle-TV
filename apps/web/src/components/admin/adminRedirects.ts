/**
 * Les adresses de l'administration qui ont DÉMÉNAGÉ — et leur nouvelle place.
 *
 * La réorganisation du 26/10 (lot « Octave qualité ») a sorti de « Services »
 * (devenue « Jellyfin ») ce qui regarde le serveur lui-même : la base de
 * données et la zone de danger vivent dans « Système ». Les liens d'avant
 * (tableau de bord d'un client plus ancien, nouveautés, favoris, une ancre
 * tapée à la main) doivent toujours mener au bon endroit : on les réécrit ici,
 * une fois, plutôt que de laisser chaque lien à jour… ou pas.
 *
 * L'adresse publique et la lecture directe se règlent dans « Accès à distance »
 * dès que le serveur la déclare (`admin.remoteAccess`) : `#publicurl` et
 * `#directstreaming` y mènent alors, au formulaire des adresses. Un serveur
 * d'avant les garde dans « Jellyfin », où elles sont encore.
 *
 * Pur : ni React ni routeur, testé seul (`adminRedirects.test.ts`).
 */

/** Ce que l'adresse demande : chemin et ancre (`#…`, vide sans ancre). */
export interface AdminLocation {
  pathname: string;
  hash: string;
}

export interface AdminRedirectContext {
  /** Le serveur déclare `admin.remoteAccess` (capacité prouvée, jamais supposée). */
  remoteAccess: boolean;
}

const SERVICES = "/admin/services";
/** Ancres de « Services » parties dans « Système ». */
const TO_SYSTEM = new Set(["database", "danger"]);
/** Ancres de « Services » réglées par « Accès à distance » quand le serveur la sait. */
const TO_REMOTE_ACCESS = new Set(["publicurl", "directstreaming", "addresses-moved"]);

/** La nouvelle adresse d'une ancienne, ou `null` si elle n'a pas bougé. */
export function movedAdminTarget(location: AdminLocation, context: AdminRedirectContext): string | null {
  const pathname = location.pathname.replace(/\/+$/, "");
  if (pathname !== SERVICES) return null;
  const anchor = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (TO_SYSTEM.has(anchor)) return `/admin/system#${anchor}`;
  if (context.remoteAccess && TO_REMOTE_ACCESS.has(anchor)) return "/admin/remote-access#addresses";
  return null;
}
