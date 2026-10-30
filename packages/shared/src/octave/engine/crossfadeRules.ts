/**
 * La « transition douce » d'Octave : les règles PURES du fondu enchaîné, communes à TOUS les moteurs — web,
 * bureau, mobile (`crossfadeRules.test.ts`). Le moteur `<audio>` les applique lui-même ; celui du bureau reçoit, avec le
 * suivant, la durée déjà décidée ici (`crossfadeMs` du pont) — la coquille ne décide rien.
 *
 * - Un VRAI fondu enchaîné : le suivant démarre AVANT la fin du courant, les deux sonnent ensemble, à
 *   puissance constante (courbes « equal-power » : cos² + sin² = 1, jamais un creux ni une bosse à mi-fondu
 *   comme avec deux droites).
 * - Seulement entre deux titres ENCHAÎNÉS par la file. Un geste (Suivant, un titre choisi) coupe net, en une
 *   sortie courte et sans clic, comme Spotify ; une file finie s'arrête sur la fin du titre.
 * - Jamais à l'intérieur d'un album écouté dans l'ordre (le titre suivant du même disque, ou le premier du
 *   disque suivant) : un album s'enchaîne SANS BLANC, comme il a été mixé — un live, un concept, une
 *   symphonie ne se coupent pas en fondus.
 * - La durée se plie aux titres : jamais plus d'un tiers du plus court des deux, et rien sous une seconde.
 */

import type { MusicTrack } from "../../music";

/** Bornes du réglage (s) : 0 = coupée, sinon de 2 à 12 s — la plage de Spotify, sans ses 1 s qui ne s'entendent pas. */
export const CROSSFADE_MIN_S = 2;
export const CROSSFADE_MAX_S = 12;
/**
 * La durée proposée quand on allume la transition, et celle d'un appareil qui n'a jamais rien choisi : la
 * transition est ALLUMÉE d'office, à 5 s (décision de Damien, lot « fl » du 30/10 ; 3 s depuis le 28/10). Rien
 * n'est écrit tant que l'utilisateur ne choisit pas : un appareil qui n'a jamais touché au réglage passe à 5 s, une
 * valeur choisie (3 s comprise) reste la sienne.
 */
export const CROSSFADE_DEFAULT_S = 5;
/** Le réglage d'un appareil qui n'a rien choisi (ms). */
export const CROSSFADE_DEFAULT_MS = CROSSFADE_DEFAULT_S * 1_000;
/** En deçà, un fondu ne s'entend plus comme tel : enchaînement ordinaire. */
const MIN_PLANNED_MS = 1_000;
/** Part du plus court des deux titres que le fondu peut couvrir. */
const MAX_SHARE = 1 / 3;

/** La valeur lue (stockage, pont) → une durée valide en ms : 0, ou 2 000 à 12 000 par pas d'une seconde. */
export function sanitizeCrossfadeMs(raw: unknown): number {
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  const seconds = Math.round(value / 1_000);
  return Math.min(CROSSFADE_MAX_S, Math.max(CROSSFADE_MIN_S, seconds)) * 1_000;
}

/** `next` suit-il `current` DANS son album, dans l'ordre (même disque +1, ou premier titre du disque suivant) ? */
export function continuesAlbum(current: MusicTrack, next: MusicTrack, albumKey: (t: MusicTrack) => string | null): boolean {
  const album = albumKey(current);
  if (album === null || album !== albumKey(next)) return false;
  const [cd, ct, nd, nt] = [current.discNumber ?? 1, current.trackNumber, next.discNumber ?? 1, next.trackNumber];
  // Numéros inconnus dans le même album : on le tient pour enchaîné (un blanc vaut mieux qu'un fondu dans un live).
  if (ct === null || nt === null) return true;
  return (nd === cd && nt === ct + 1) || (nd === cd + 1 && nt === 1);
}

export interface CrossfadePair {
  current: MusicTrack;
  next: MusicTrack;
  /** Durées les mieux connues (source, sinon titre), ms. */
  currentMs: number | null;
  nextMs: number | null;
}

/** La durée du fondu entre ces deux titres (ms), 0 : enchaînement ordinaire. */
export function plannedCrossfadeMs(settingMs: number, pair: CrossfadePair, albumKey: (t: MusicTrack) => string | null): number {
  const wanted = sanitizeCrossfadeMs(settingMs);
  if (wanted === 0 || pair.currentMs === null || pair.nextMs === null) return 0;
  if (continuesAlbum(pair.current, pair.next, albumKey)) return 0;
  const room = Math.min(pair.currentMs, pair.nextMs) * MAX_SHARE;
  const planned = Math.floor(Math.min(wanted, room));
  return planned < MIN_PLANNED_MS ? 0 : planned;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Le gain du titre qui PART à la fraction `x` du fondu (0 → 1, puis 0). */
export const fadeOutGain = (x: number): number => Math.cos((clamp01(x) * Math.PI) / 2);

/** Le gain du titre qui ARRIVE à la fraction `x` du fondu (0 → 0, puis 1). */
export const fadeInGain = (x: number): number => Math.sin((clamp01(x) * Math.PI) / 2);
