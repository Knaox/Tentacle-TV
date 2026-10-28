/**
 * Octave — ce qui se décide sans image pour une pochette :
 *
 * - le REPLI d'une pochette absente : une teinte de la famille Tentacle tirée du
 *   titre (toujours la même pour le même titre, jamais une case grise), et pour
 *   un artiste son initiale ;
 * - la TAILLE demandée au cœur pour une vignette de liste : `/api/music/artwork`
 *   sert 64 · 128 · 256 · 512 · 1024 px (512 sans `size`) ; une rangée de 40 px
 *   n'a pas à tirer 512 px — sur une liste de 500 titres, l'écart se compte en
 *   mégaoctets.
 */

import { releaseArtSized } from "@tentacle-tv/shared/music";

/** Le nombre de teintes de repli (`octaveViews.css`, `[data-tone]`). */
export const FALLBACK_TONES = 6;

/** La teinte de repli d'un titre : un hachage stable, réparti sur les teintes. */
export function fallbackTone(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % FALLBACK_TONES;
}

/** L'initiale d'un nom (« The Cure » → « C », « ¡Forward! » → « F ») ; rien sans lettre ni chiffre. */
export function initialOf(name: string): string {
  const words = name.trim().split(/\s+/);
  // Un article anglais ou français en tête ne fait pas l'initiale d'un groupe.
  const meaningful = words.length > 1 && /^(the|les?|la|l'|a|an)$/i.test(words[0] ?? "") ? words.slice(1) : words;
  const match = meaningful.join(" ").match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLocaleUpperCase() : "";
}

/** La taille d'une vignette de liste (≤ 64 px affichés, nette sur un écran ×2). */
export const THUMB_ARTWORK_SIZE = 128;

/**
 * L'adresse d'une image du cœur à la taille voulue. Une adresse d'un autre hôte
 * (https) reste telle quelle : la taille est une règle de NOTRE route.
 */
export function sizedArtworkUrl(url: string, size: number): string {
  // Une pochette IMPORTÉE (musicReleases.ts) a ses tailles fixes : la plus petite, 300.
  const imported = releaseArtSized(url, "300");
  if (imported !== url) return imported;
  // Un autre hôte, une image gardée sur l'appareil (`tentacle://local`, `blob:`) : telle quelle.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /[?&]size=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}size=${size}`;
}
