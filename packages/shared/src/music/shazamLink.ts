/**
 * Octave — un lien SHAZAM partagé vers Tentacle TV (feuille de partage, ou collé dans la recherche) devient une
 * RECHERCHE du titre. Règle pure, commune au serveur, au web, au bureau et au mobile.
 *
 * Formes reconnues (liste fermée d'hôtes, jamais un autre) :
 * - `https://www.shazam.com/track/<id>/<slug>` et `…/song/<id>/<slug>`, avec ou sans préfixe de langue (`/fr-fr/`) ;
 * - `https://shz.am/<code>` (lien court : seul le serveur peut le suivre).
 * Le titre et l'artiste se lisent, dans l'ordre : par le serveur (capacité `music.sharedLinks`) — un `/song/<id>`
 * porte l'identifiant APPLE MUSIC du titre (catalogue iTunes), un `/track/<id>` la clé SHAZAM (catalogue de
 * Shazam) —, sinon dans le texte du partage (« I used Shazam to discover X by Y »), sinon dans le slug.
 * (La page web de Shazam ne sert à rien : son `og:title` est celui d'un titre en vogue, pas du lien — mesuré.)
 */

export type ShazamLink =
  | { kind: "track"; url: string; catalog: "shazam" | "apple"; trackId: string; slug: string | null }
  | { kind: "short"; url: string; code: string };

/** Ce qu'un lien de titre donne à chercher : le titre, l'artiste s'il est connu, et la requête à poser. */
export interface SharedTrackQuery {
  source: "shazam";
  title: string;
  artist: string | null;
  query: string;
}

const CANDIDATE = /https?:\/\/[^\s<>"'«»]+/gi;
const TRAILING = /[.,;:!?)\]}…]+$/;
const TRACK_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(track|song)\/(\d{1,15})(?:\/([^/?#]+))?\/?$/i;
const SHORT_PATH = /^\/([A-Za-z0-9_-]{1,40})\/?$/;
const TEXT_MAX = 4096;

function urlOf(candidate: string): URL | null {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** Un seul lien, tel quel → sa forme Shazam ; `null` pour tout autre hôte ou chemin. */
export function recognizeShazamUrl(candidate: string): ShazamLink | null {
  const url = urlOf(candidate.trim());
  if (!url || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === "shazam.com" || host === "www.shazam.com") {
    const match = TRACK_PATH.exec(url.pathname);
    if (!match) return null;
    const slug = match[3] ? safeDecode(match[3]) : null;
    const catalog = match[1]!.toLowerCase() === "song" ? "apple" : "shazam";
    return { kind: "track", url: url.toString(), catalog, trackId: match[2]!, slug: slug || null };
  }
  if (host === "shz.am" || host === "www.shz.am") {
    const match = SHORT_PATH.exec(url.pathname);
    return match ? { kind: "short", url: url.toString(), code: match[1]! } : null;
  }
  return null;
}

/** Le premier lien Shazam d'un texte (les apps partagent rarement un lien nu) ; `null` s'il n'y en a pas. */
export function findShazamLink(text: string | null | undefined): ShazamLink | null {
  if (!text) return null;
  for (const match of text.slice(0, TEXT_MAX).matchAll(CANDIDATE)) {
    const link = recognizeShazamUrl(match[0].replace(TRAILING, ""));
    if (link) return link;
  }
  return null;
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** La requête d'un titre et d'un artiste (l'artiste en second : la recherche d'Octave classe mieux ainsi). */
export function trackQueryOf(title: string, artist: string | null): SharedTrackQuery | null {
  const t = clean(title).slice(0, 160);
  const a = artist ? clean(artist).slice(0, 120) : "";
  if (!t) return null;
  return { source: "shazam", title: t, artist: a || null, query: a ? `${t} ${a}` : t };
}

/** Le slug (`blinding-lights`) → « blinding lights » : le dernier repli, sans artiste. */
export function shazamSlugQuery(link: ShazamLink): SharedTrackQuery | null {
  if (link.kind !== "track" || !link.slug) return null;
  return trackQueryOf(link.slug.replace(/[-_+]+/g, " "), null);
}

// Le message d'accompagnement de Shazam, dans les deux langues de l'app (texte d'un partage, jamais une page).
const SHARE_TEXT = [
  /shazam to discover\s+(.+?)\s+by\s+(.+?)\.?\s*(?:https?:\/\/|$)/i,
  /pour d[ée]couvrir\s+(.+?)\s+(?:de|par)\s+(.+?)\.?\s*(?:https?:\/\/|$)/i,
  /d[ée]couvert\s+(.+?)\s+(?:de|par)\s+(.+?)\s+(?:avec|gr[âa]ce [àa]|sur)\s+shazam/i,
];

/** Le titre et l'artiste du MESSAGE qui accompagne le lien, quand Shazam l'a écrit ; sinon `null`. */
export function shazamShareTextQuery(text: string | null | undefined): SharedTrackQuery | null {
  if (!text) return null;
  const head = text.slice(0, TEXT_MAX);
  for (const pattern of SHARE_TEXT) {
    const match = pattern.exec(head);
    if (match) return trackQueryOf(match[1]!.replace(/^[«"“]|[»"”]$/g, ""), match[2]!.replace(/^[«"“]|[»"”]$/g, ""));
  }
  return null;
}

/** Ce qu'un client sait seul d'un texte partagé (le message, sinon le slug) — sans le serveur. */
export function localSharedTrackQuery(text: string, link: ShazamLink): SharedTrackQuery | null {
  return shazamShareTextQuery(text) ?? shazamSlugQuery(link);
}

/** `GET <route>?url=<lien Shazam>` → `SharedTrackQuery` (capacité `music.sharedLinks`). */
export const MUSIC_SHARED_TRACK_ROUTE = "/api/music/links/track";
/** Les refus de la route, liste FERMÉE : lien non reconnu, titre introuvable, Shazam injoignable. */
export type SharedTrackRefusal = "unsupported" | "not_found" | "unavailable";
