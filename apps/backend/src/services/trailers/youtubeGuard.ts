/* ------------------------------------------------------------------ */
/*  Ménager YouTube : le disjoncteur, le budget des aperçus et celui    */
/*  des lectures                                                        */
/*                                                                     */
/*  L'aperçu au survol multiplie les extractions (une à trois par      */
/*  titre froid). Mesuré le 2026-10-14 : après ≥ 146 extractions d'une */
/*  nuit de bancs, YouTube a placé l'adresse de la maison sous         */
/*  vérification anti-robot — PLUS AUCUNE extraction, Apple TV         */
/*  comprise. Les garde-fous (`sourceGuard.ts`) :                      */
/*  - le DISJONCTEUR : YouTube demande une vérification ou dit sa      */
/*    limite → plus aucune extraction d'aperçu pendant 30 min, doublées */
/*    à chaque rechute jusqu'à 4 h, remises à zéro par la première     */
/*    extraction réussie (une lecture de la TV suffit) ;               */
/*  - le BUDGET DES APERÇUS : 30 extractions par heure glissante pour  */
/*    tout le serveur — une famille qui parcourt sa bibliothèque en     */
/*    survole rarement plus de nouveaux titres en une heure (chaque     */
/*    décision est gardée des heures), et c'est un dixième de ce que    */
/*    yt-dlp donne pour limite à une session invitée (~300 vidéos par  */
/*    heure) ;                                                         */
/*  - le BUDGET DES LECTURES (le lecteur du web et du bureau lit par   */
/*    le relais) : 60 extractions par heure pour le serveur, et par    */
/*    compte 10 d'avance puis une par minute. Au-delà, ou disjoncteur  */
/*    ouvert, le client ouvre le lecteur officiel ; disjoncteur ouvert,*/
/*    une lecture-SONDE passe toutes les 5 minutes — réussie, elle le  */
/*    referme.                                                         */
/* ------------------------------------------------------------------ */

import { SlidingBudget, SourceBreaker, TokenBuckets, type GuardReason, type GuardStatus } from "./sourceGuard";

export type BlockKind = Extract<GuardReason, "bot" | "limit">;

export type PreviewRefusal = { kind: "blocked"; remainingMs: number } | { kind: "budget"; retryAfterMs: number };

/** Pourquoi une lecture ne peut pas extraire : la source bloque, le serveur ou le compte a épuisé son budget. */
export type PlaybackRefusal =
  | { kind: "blocked"; remainingMs: number }
  | { kind: "budget"; retryAfterMs: number }
  | { kind: "account"; retryAfterMs: number };

export const PREVIEW_EXTRACTIONS_PER_HOUR = 30;
export const PLAYBACK_EXTRACTIONS_PER_HOUR = 60;
const HOUR_MS = 60 * 60_000;
const PLAYBACK_ACCOUNT_BURST = 10;
const PLAYBACK_ACCOUNT_REFILL_MS = 60_000;
const PROBE_EVERY_MS = 5 * 60_000;

export const youtubeBreaker = new SourceBreaker({
  tripLine: (reason, min) =>
    `[trailers] ${reason === "bot" ? "YouTube demande une vérification anti-robot" : "YouTube limite les demandes de ce serveur"} — aperçus suspendus ${min} min`,
  recoveredLine: "[trailers] YouTube répond de nouveau — aperçus repris",
});
export const previewBudget = new SlidingBudget(PREVIEW_EXTRACTIONS_PER_HOUR, HOUR_MS);
export const playbackBudget = new SlidingBudget(PLAYBACK_EXTRACTIONS_PER_HOUR, HOUR_MS);
const playbackAccounts = new TokenBuckets(PLAYBACK_ACCOUNT_BURST, PLAYBACK_ACCOUNT_REFILL_MS);
let lastProbeAt = -Infinity;
let budgetReported = false;

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

/**
 * YouTube bride l'adresse : plus d'aperçu pendant la durée en cours, et la
 * suivante doublée. Sans effet tant que le disjoncteur est déjà ouvert —
 * des échecs simultanés ne le prolongent pas.
 */
export function tripYouTubeBreaker(kind: BlockKind, now = Date.now()): void {
  youtubeBreaker.trip(kind, now);
}

/** Une extraction a réussi : YouTube répond de nouveau, le disjoncteur se referme et repart de 30 min. */
export function recordYouTubeSuccess(now = Date.now()): void {
  youtubeBreaker.recordSuccess(now);
}

/** Le disjoncteur est-il ouvert ? (`/prepare` ne part pas pendant une pause.) */
export function youtubeBreakerOpen(now = Date.now()): boolean {
  return youtubeBreaker.remainingMs(now) > 0;
}

/**
 * Pourquoi un aperçu ne peut pas contacter YouTube en ce moment, ou `null` :
 * le disjoncteur est ouvert, ou le budget de l'heure est épuisé (avec le
 * délai honnête avant la prochaine place).
 */
export function previewRefusal(now = Date.now()): PreviewRefusal | null {
  const remainingMs = youtubeBreaker.remainingMs(now);
  if (remainingMs > 0) return { kind: "blocked", remainingMs };
  const retryAfterMs = previewBudget.refusal(now);
  if (retryAfterMs === null) {
    budgetReported = false;
    return null;
  }
  if (!budgetReported) {
    budgetReported = true;
    console.warn(`[trailers] aperçus : ${PREVIEW_EXTRACTIONS_PER_HOUR} extractions dans l'heure — les suivantes attendent ${minutes(retryAfterMs)} min`);
  }
  return { kind: "budget", retryAfterMs };
}

/** Une extraction d'aperçu commence : elle compte dans le budget de l'heure. */
export function countPreviewExtraction(now = Date.now()): void {
  previewBudget.count(now);
}

/**
 * Une LECTURE de `account` peut-elle extraire maintenant ? `null` : oui, et
 * elle est comptée (budget du serveur, seau du compte) ; sinon pourquoi.
 * Disjoncteur ouvert, une seule lecture-sonde toutes les 5 minutes passe —
 * c'est elle qui le refermera si YouTube répond (`recordYouTubeSuccess`).
 * Une vidéo que le relais tient déjà ne demande rien : ne pas appeler.
 */
export function takeYouTubePlayback(account: string, now = Date.now()): PlaybackRefusal | null {
  const remainingMs = youtubeBreaker.remainingMs(now);
  if (remainingMs > 0) {
    if (now - lastProbeAt < PROBE_EVERY_MS) return { kind: "blocked", remainingMs };
    lastProbeAt = now;
    console.log("[trailers] YouTube en pause — une lecture-sonde essaie");
    playbackBudget.count(now);
    return null;
  }
  const serverWait = playbackBudget.refusal(now);
  if (serverWait !== null) return { kind: "budget", retryAfterMs: serverWait };
  const accountWait = playbackAccounts.take(account, now);
  if (accountWait > 0) return { kind: "account", retryAfterMs: accountWait };
  playbackBudget.count(now);
  return null;
}

/** L'état de YouTube pour l'administration. */
export function youtubeGuardStatus(now = Date.now()): GuardStatus {
  return youtubeBreaker.status(now);
}

/** Pour les tests : repartir d'un disjoncteur fermé et de budgets pleins. */
export function resetYouTubeGuard(): void {
  youtubeBreaker.reset();
  previewBudget.reset();
  playbackBudget.reset();
  playbackAccounts.reset();
  lastProbeAt = -Infinity;
  budgetReported = false;
}
