/**
 * Poids et décroissances des signaux d'un compte, titre par titre (les
 * « ancres » du goût, cf. anchors.ts). Réglés au banc d'évaluation, contre les
 * défauts relevés sur un vrai compte : lectures de test comptées comme des
 * revisionnages, historique marqué « vu » en masse daté du jour du marquage,
 * série de deux minutes par épisode pesant autant que Game of Thrones.
 */

// ── Poids de base (avant décroissance) ──────────────────────────────────────
export const ANCHOR_FAVORITE = 0.8;
/** « J'aime » d'un titre hors bibliothèque — un favori qu'on n'a pas. */
export const ANCHOR_LIKE = 0.7;
/** « Ma liste » : une intention, pas un visionnage. */
export const ANCHOR_WATCHLIST = 0.3;
export const ANCHOR_COMPLETED = 0.5;
/** Revisionnage VÉRIFIÉ : au moins deux jours distincts de visionnage mesuré. */
export const ANCHOR_REWATCH = 0.35;
/** Compteur Jellyfin ≥ 2 sans mesure : un test de lecteur l'incrémente aussi
 *  (183 « lectures » d'un film vu une fois) — l'indice reste faible. */
export const ANCHOR_REWATCH_UNVERIFIED = 0.1;
export const ANCHOR_ABANDON = -0.6;
/** « Ne plus me proposer » : le titre ne plaît pas, ses voisins non plus. */
export const ANCHOR_DISMISSED = -0.35;
export const ANCHOR_NOT_INTERESTED = -0.6;

// ── Onglet « Affiner » (swipe) ──────────────────────────────────────────────
/** Like d'une carte : un goût déclaré, du poids d'un « J'aime » de fiche. */
export const ANCHOR_SWIPE_LIKE = 0.7;
/** Super like : au-dessus d'un favori (0,8) — c'est un coup de cœur appuyé,
 *  et il fait aussitôt une graine forte. */
export const ANCHOR_SWIPE_SUPERLIKE = 1.2;
/** Dislike : le poids d'un « Pas intéressé ». Le titre sort des rangées ; ses
 *  voisins (genres, mots-clés, univers) ne sont touchés QUE par la composante
 *  « ressemblance aux refus » du classement, bornée (cf. tasteStrategy). */
export const ANCHOR_SWIPE_DISLIKE = -0.6;

/** Poids de base d'un verdict de swipe ; 0 pour « passé » (ou inconnu). */
export function swipeAnchorWeight(verdict: string): number {
  if (verdict === "superlike") return ANCHOR_SWIPE_SUPERLIKE;
  if (verdict === "like") return ANCHOR_SWIPE_LIKE;
  if (verdict === "dislike") return ANCHOR_SWIPE_DISLIKE;
  return 0;
}

/** Bornes du poids cumulé d'un titre (note 10 + favori + vu + revu…). */
export const ANCHOR_MAX = 2.5;
export const ANCHOR_MIN = -1.5;

// ── Séries : l'engagement au TEMPS regardé ──────────────────────────────────
/** Durée d'épisode supposée quand Jellyfin ne la donne pas. */
export const EPISODE_FALLBACK_HOURS = 0.5;
/** Une série est suivie dès trois épisodes, ou deux heures regardées. */
export const SERIES_MIN_EPISODES = 3;
export const SERIES_MIN_HOURS = 2;
const SERIES_WEIGHT_MIN = 0.45;
const SERIES_WEIGHT_MAX = 1.1;
/** Heures au-delà desquelles l'engagement est plein. */
const SERIES_FULL_HOURS = 40;

/**
 * Poids d'une série suivie selon les HEURES regardées (croissance
 * logarithmique, 1 h → 0,45 ; 40 h et plus → 1,1). Au nombre d'épisodes,
 * 128 épisodes de deux minutes pesaient autant que 73 épisodes d'une heure.
 */
export function seriesEngagementByHours(hours: number, episodes: number): number {
  if (!(episodes >= SERIES_MIN_EPISODES || hours >= SERIES_MIN_HOURS)) return 0;
  const t = Math.log(Math.max(1, hours)) / Math.log(SERIES_FULL_HOURS);
  const clamped = Math.min(1, Math.max(0, t));
  return SERIES_WEIGHT_MIN + (SERIES_WEIGHT_MAX - SERIES_WEIGHT_MIN) * clamped;
}

// ── Décroissance ────────────────────────────────────────────────────────────
/** Signaux EXPLICITES (note, favori, like, refus) : un goût déclaré dure. */
const EXPLICIT_HALF_LIFE_DAYS = 730;
const EXPLICIT_FLOOR = 0.6;
/** Signaux IMPLICITES (vu, suivi, abandon) : l'humeur du moment compte plus. */
const IMPLICIT_HALF_LIFE_DAYS = 365;
const IMPLICIT_FLOOR = 0.35;

export function explicitDecay(ageDays: number): number {
  if (!(ageDays > 0)) return 1;
  return Math.max(EXPLICIT_FLOOR, Math.pow(0.5, ageDays / EXPLICIT_HALF_LIFE_DAYS));
}

export function implicitDecay(ageDays: number): number {
  if (!(ageDays > 0)) return 1;
  return Math.max(IMPLICIT_FLOOR, Math.pow(0.5, ageDays / IMPLICIT_HALF_LIFE_DAYS));
}

// ── Marquages « vu » en masse ───────────────────────────────────────────────
/** Titres partageant la même minute de « dernière lecture » : au-delà, c'est
 *  un marquage en masse (saison ou historique entier), pas un visionnage. */
export const BULK_MIN_ITEMS = 4;
/** Âge prêté à un titre marqué en masse : vu « il y a longtemps », sans date. */
export const BULK_AGE_DAYS = 365;

/** Minute UTC d'une date ISO (« 2026-09-05T18:42 ») — la clé du regroupement. */
function minuteOf(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 16) : null;
}

/**
 * Les minutes de « dernière lecture » qui trahissent un marquage en masse :
 * au moins BULK_MIN_ITEMS titres (films et épisodes confondus) dans la même
 * minute. Un visionnage réel n'en met jamais autant — même en rafale, deux
 * épisodes sont séparés par leur durée.
 */
export function bulkMinutes(dates: Iterable<string | null | undefined>): Set<string> {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const m = d ? minuteOf(d) : null;
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  const out = new Set<string>();
  for (const [m, n] of counts) if (n >= BULK_MIN_ITEMS) out.add(m);
  return out;
}

/** Âge en jours d'une date de lecture, relevé à BULK_AGE_DAYS si elle tombe
 *  dans une minute de marquage en masse. Sans date : « ancien ». */
export function playAgeDays(date: string | null | undefined, bulk: ReadonlySet<string>, now: number): number {
  if (!date) return BULK_AGE_DAYS;
  const t = Date.parse(date);
  if (!Number.isFinite(t)) return BULK_AGE_DAYS;
  const age = Math.max(0, (now - t) / 86_400_000);
  const m = minuteOf(date);
  return m && bulk.has(m) ? Math.max(age, BULK_AGE_DAYS) : age;
}
