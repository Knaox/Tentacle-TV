/* ------------------------------------------------------------------ */
/*  Ménager YouTube : le disjoncteur et le budget des aperçus           */
/*                                                                     */
/*  L'aperçu au survol multiplie les extractions (une à trois par      */
/*  titre froid). Mesuré le 2026-10-14 : après ≥ 146 extractions d'une */
/*  nuit de bancs, YouTube a placé l'adresse de la maison sous         */
/*  vérification anti-robot — PLUS AUCUNE extraction, Apple TV         */
/*  comprise. Deux garde-fous, pour les aperçus SEULEMENT (une lecture */
/*  demandée à la TV ou préparée par une fiche n'en change rien) :     */
/*  - le DISJONCTEUR : YouTube demande une vérification ou dit sa      */
/*    limite → plus aucune extraction d'aperçu pendant 30 min, doublées */
/*    à chaque rechute jusqu'à 4 h, remises à zéro par la première     */
/*    extraction réussie (une lecture de la TV suffit) ;               */
/*  - le BUDGET : 30 extractions d'aperçu par heure glissante pour tout */
/*    le serveur — une famille qui parcourt sa bibliothèque en survole  */
/*    rarement plus de nouveaux titres en une heure (chaque décision    */
/*    est gardée des heures), et c'est un dixième de ce que yt-dlp     */
/*    donne pour limite à une session invitée (~300 vidéos par heure) : */
/*    les lectures gardent toute la marge.                             */
/* ------------------------------------------------------------------ */

export type BlockKind = "bot" | "limit";

export type PreviewRefusal = { kind: "blocked"; remainingMs: number } | { kind: "budget"; retryAfterMs: number };

const BREAKER_BASE_MS = 30 * 60_000;
const BREAKER_MAX_MS = 4 * 60 * 60_000;
export const PREVIEW_EXTRACTIONS_PER_HOUR = 30;
const WINDOW_MS = 60 * 60_000;

let openUntil = 0;
let nextOpenMs = BREAKER_BASE_MS;
/** Le début de chaque extraction d'aperçu de l'heure écoulée, du plus ancien au plus récent. */
const previewStarts: number[] = [];
let budgetReported = false;

const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));

/**
 * YouTube bride l'adresse : plus d'aperçu pendant la durée en cours, et la
 * suivante doublée. Sans effet tant que le disjoncteur est déjà ouvert —
 * des échecs simultanés ne le prolongent pas.
 */
export function tripYouTubeBreaker(kind: BlockKind, now = Date.now()): void {
  if (openUntil > now) return;
  openUntil = now + nextOpenMs;
  const what = kind === "bot" ? "YouTube demande une vérification anti-robot" : "YouTube limite les demandes de ce serveur";
  console.warn(`[trailers] ${what} — aperçus suspendus ${minutes(nextOpenMs)} min`);
  nextOpenMs = Math.min(nextOpenMs * 2, BREAKER_MAX_MS);
}

/** Une extraction a réussi : YouTube répond de nouveau, le disjoncteur se referme et repart de 30 min. */
export function recordYouTubeSuccess(now = Date.now()): void {
  if (openUntil > now || nextOpenMs > BREAKER_BASE_MS) console.log("[trailers] YouTube répond de nouveau — aperçus repris");
  openUntil = 0;
  nextOpenMs = BREAKER_BASE_MS;
}

function prune(now: number): void {
  while (previewStarts.length > 0 && previewStarts[0] <= now - WINDOW_MS) previewStarts.shift();
}

/**
 * Pourquoi un aperçu ne peut pas contacter YouTube en ce moment, ou `null` :
 * le disjoncteur est ouvert, ou le budget de l'heure est épuisé (avec le
 * délai honnête avant la prochaine place).
 */
export function previewRefusal(now = Date.now()): PreviewRefusal | null {
  if (openUntil > now) return { kind: "blocked", remainingMs: openUntil - now };
  prune(now);
  if (previewStarts.length < PREVIEW_EXTRACTIONS_PER_HOUR) {
    budgetReported = false;
    return null;
  }
  const retryAfterMs = previewStarts[0] + WINDOW_MS - now;
  if (!budgetReported) {
    budgetReported = true;
    console.warn(`[trailers] aperçus : ${PREVIEW_EXTRACTIONS_PER_HOUR} extractions dans l'heure — les suivantes attendent ${minutes(retryAfterMs)} min`);
  }
  return { kind: "budget", retryAfterMs };
}

/** Une extraction d'aperçu commence : elle compte dans le budget de l'heure. */
export function countPreviewExtraction(now = Date.now()): void {
  previewStarts.push(now);
}

/** Pour les tests : repartir d'un disjoncteur fermé et d'un budget plein. */
export function resetYouTubeGuard(): void {
  openUntil = 0;
  nextOpenMs = BREAKER_BASE_MS;
  previewStarts.length = 0;
  budgetReported = false;
}
