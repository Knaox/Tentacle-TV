/**
 * Octave — les pochettes déjà montrées lors d'une session PRÉCÉDENTE, par
 * identité (`tentacle_octave_art_known`, stockage local : des clés d'adresse
 * sans jeton, jamais une image). Elles sont dans le cache (disque de la
 * coquille au bureau, cache HTTP au web) : à la relance, `Artwork` les montre
 * d'emblée, sans fondu ni squelette — elles n'« apparaissent » plus.
 *
 * Pendant la session, la règle est celle de D5 (`lib/seenImages.ts`) : ce
 * module n'en garde que la mémoire d'une session à l'autre. Borné (les plus
 * anciennes sortent), effacé à la déconnexion (`forgetOctaveDevice`).
 * Clé de stockage : elle ne se renomme jamais.
 */

import { octaveOwner } from "../cache/octaveOwner";

export const ART_KNOWN_KEY = "tentacle_octave_art_known";
export const ART_KNOWN_MAX = 1_500;
const WRITE_DELAY_MS = 2_000;

/** La clé d'une adresse affichable : la source d'origine (celle du cache de la coquille dépliée), sans jeton. */
export function artKnownKey(src: string): string {
  let raw = src;
  try {
    const url = new URL(src);
    if (url.protocol === "tentacle:" && url.host === "art") raw = url.searchParams.get("u") ?? src;
  } catch {
    return src;
  }
  return raw.replace(/([?&])(api_key|ApiKey)=[^&]*&?/g, "$1").replace(/[?&]$/, "");
}

const owner = octaveOwner();
let known: Set<string> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function load(): Set<string> {
  if (known) return known;
  known = new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(ART_KNOWN_KEY) ?? "null") as { owner?: unknown; keys?: unknown } | null;
    if (parsed && parsed.owner === owner && Array.isArray(parsed.keys)) for (const k of parsed.keys) if (typeof k === "string") known.add(k);
  } catch {
    /* illisible : rien de connu, les pochettes reprennent leur fondu une fois */
  }
  return known;
}

function scheduleWrite(): void {
  if (timer !== null || owner === null) return;
  timer = setTimeout(() => {
    timer = null;
    try {
      localStorage.setItem(ART_KNOWN_KEY, JSON.stringify({ owner, keys: [...load()].slice(-ART_KNOWN_MAX) }));
    } catch {
      /* stockage plein : la mémoire vaut pour cette session */
    }
  }, WRITE_DELAY_MS);
}

/** Cette pochette a-t-elle déjà été montrée à cette identité (une session d'avant comprise) ? */
export function isArtworkKnown(src: string | null): boolean {
  return src !== null && owner !== null && load().has(artKnownKey(src));
}

/** La pochette s'est chargée : elle sera montrée d'emblée aux prochaines sessions. */
export function markArtworkKnown(src: string): void {
  if (owner === null) return;
  const set = load();
  const key = artKnownKey(src);
  if (set.has(key)) {
    set.delete(key);
    set.add(key);
    return;
  }
  set.add(key);
  if (set.size > ART_KNOWN_MAX) {
    const oldest = set.values().next().value;
    if (oldest !== undefined) set.delete(oldest);
  }
  scheduleWrite();
}

export function forgetArtworkKnown(): void {
  known = new Set();
  try {
    localStorage.removeItem(ART_KNOWN_KEY);
  } catch {
    /* rien à oublier */
  }
}
