/**
 * Les réglages de lecture d'un COMPTE — segments et enchaînement d'épisode.
 *
 * Ils remplacent les trois clés d'appareil historiques : ces choix suivent
 * désormais l'utilisateur d'un écran à l'autre (table `playback_settings`
 * côté backend, cache local côté client pour répondre hors ligne).
 *
 * Trois familles, et une règle : les trois réglages d'« épisode suivant »
 * sont STRICTEMENT indépendants — afficher la fiche, décompter, enchaîner.
 * L'intrication historique (couper le décompte masquait la fiche) est le bug
 * que cette structure interdit.
 *
 * MIROIR : ce fichier est reflété octet pour octet dans
 * `apps/backend/src/playback/` (voir l'en-tête de `segmentTypes.ts`) — ne
 * rien importer, la normalisation doit rester copiable telle quelle.
 */

export type SegmentAction = "button" | "auto" | "off";

export interface SegmentSettings {
  /** `button` : proposer ; `auto` : décompte puis saut ; `off` : ne rien faire. */
  action: SegmentAction;
  /** Montrer le décompte quand `action === "auto"`. */
  countdownVisible: boolean;
  /** Délai avant le saut automatique, en millisecondes. */
  autoDelayMs: number;
}

export interface NextEpisodeSettings {
  /** Afficher la fiche « à suivre ». */
  nextCard: boolean;
  /** Afficher un compte à rebours sur la fiche et l'écran de fin. */
  nextCountdown: boolean;
  /** Lancer l'épisode suivant à l'expiration du décompte. */
  nextAutoPlay: boolean;
  /** Quand proposer la suite : au début du générique, ou peu avant la fin. */
  nextTrigger: "outroStart" | "beforeEnd";
  /** Le « peu avant la fin », en secondes (sert aussi de repli sans Outro). */
  nextBeforeEndSeconds: number;
}

export interface PlaybackSettings {
  intro: SegmentSettings;
  outro: SegmentSettings;
  recap: SegmentSettings;
  preview: SegmentSettings;
  next: NextEpisodeSettings;
}

export const SEGMENT_AUTO_DELAY_DEFAULT_MS = 3_000;
export const SEGMENT_AUTO_DELAY_MAX_MS = 30_000;
export const NEXT_BEFORE_END_SECONDS_DEFAULT = 45;
export const NEXT_BEFORE_END_SECONDS_MIN = 5;
export const NEXT_BEFORE_END_SECONDS_MAX = 300;

/**
 * Défauts VALIDÉS : intro en saut automatique (le comportement livré « activé
 * d'origine » est conservé — décision explicite, la spec initiale disait
 * bouton) ; générique en bouton ; récap et aperçu ne font rien tant que
 * l'utilisateur ne les active pas ; les trois réglages d'épisode suivant
 * allumés, déclencheur au début du générique.
 */
export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  intro: { action: "auto", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  outro: { action: "button", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  recap: { action: "off", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  preview: { action: "off", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  next: {
    nextCard: true,
    nextCountdown: true,
    nextAutoPlay: true,
    nextTrigger: "outroStart",
    nextBeforeEndSeconds: NEXT_BEFORE_END_SECONDS_DEFAULT,
  },
};

export function isSegmentAction(value: unknown): value is SegmentAction {
  return value === "button" || value === "auto" || value === "off";
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function booleanField(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSegment(raw: unknown, defaults: SegmentSettings): SegmentSettings {
  if (typeof raw !== "object" || raw === null) return { ...defaults };
  const o = raw as Record<string, unknown>;
  return {
    action: isSegmentAction(o.action) ? o.action : defaults.action,
    countdownVisible: booleanField(o.countdownVisible, defaults.countdownVisible),
    autoDelayMs: clampInt(o.autoDelayMs, 0, SEGMENT_AUTO_DELAY_MAX_MS, defaults.autoDelayMs),
  };
}

function normalizeNext(raw: unknown, defaults: NextEpisodeSettings): NextEpisodeSettings {
  if (typeof raw !== "object" || raw === null) return { ...defaults };
  const o = raw as Record<string, unknown>;
  return {
    nextCard: booleanField(o.nextCard, defaults.nextCard),
    nextCountdown: booleanField(o.nextCountdown, defaults.nextCountdown),
    nextAutoPlay: booleanField(o.nextAutoPlay, defaults.nextAutoPlay),
    nextTrigger:
      o.nextTrigger === "outroStart" || o.nextTrigger === "beforeEnd"
        ? o.nextTrigger
        : defaults.nextTrigger,
    nextBeforeEndSeconds: clampInt(
      o.nextBeforeEndSeconds,
      NEXT_BEFORE_END_SECONDS_MIN,
      NEXT_BEFORE_END_SECONDS_MAX,
      defaults.nextBeforeEndSeconds,
    ),
  };
}

/**
 * Rend TOUJOURS des réglages complets et sains : une réponse partielle, une
 * colonne farfelue, un cache d'une vieille version — chaque champ illisible
 * retombe sur son défaut, jamais d'exception.
 */
export function normalizePlaybackSettings(raw: unknown): PlaybackSettings {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_PLAYBACK_SETTINGS;
  return {
    intro: normalizeSegment(o.intro, d.intro),
    outro: normalizeSegment(o.outro, d.outro),
    recap: normalizeSegment(o.recap, d.recap),
    preview: normalizeSegment(o.preview, d.preview),
    next: normalizeNext(o.next, d.next),
  };
}
