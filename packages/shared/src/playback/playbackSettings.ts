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

/** Comment se compte le « avant la fin » : en proportion, ou en secondes. */
export type BeforeEndMode = "percent" | "seconds";

export interface BeforeEndTarget {
  mode: BeforeEndMode;
  /** Pourcentage de la durée, ou secondes avant la fin. */
  value: number;
}

/**
 * Une règle ciblée : ce seuil-là, pour ces bibliothèques-là.
 *
 * Les séries d'une heure et les animés de vingt minutes n'ont pas la même
 * queue de fichier : un seuil unique se trompe forcément sur l'un des deux.
 */
export interface BeforeEndRule extends BeforeEndTarget {
  /** Bibliothèques visées. Une règle sans cible ne s'applique à rien. */
  libraryIds: string[];
}

export interface NextEpisodeSettings {
  /** Afficher la fiche « à suivre ». */
  nextCard: boolean;
  /** Afficher un compte à rebours sur la fiche et l'écran de fin. */
  nextCountdown: boolean;
  /**
   * Durée de ce compte à rebours, en millisecondes.
   *
   * Elle était figée à dix secondes dans le moteur. C'est un réglage comme le
   * délai d'un saut — même unité, même raison : c'est la seule où l'on puisse
   * demander une seconde et demie.
   *
   * ⚠️ Ce n'est qu'un PLAFOND. Le moteur ne la retient que si le média a
   * encore ce temps-là devant lui (`autoNextEngine.ts`) : une fiche qui paraît
   * quatre secondes avant la fin ne décompte pas dix secondes.
   */
  nextCountdownMs: number;
  /** Lancer l'épisode suivant à l'expiration du décompte. */
  nextAutoPlay: boolean;
  /** Quand proposer la suite : au début du générique, ou peu avant la fin. */
  nextTrigger: "outroStart" | "beforeEnd";
  /**
   * Le repli temporel est-il actif ?
   *
   * FACULTATIF, et c'est une demande : sans générique signalé et sans ce
   * repli, la fin d'un épisode reste nue — aucune fiche ne paraît, seul
   * l'écran de fin subsiste.
   */
  beforeEndEnabled: boolean;
  /** Ce qui s'applique aux bibliothèques qu'aucune règle ne vise. */
  beforeEndDefault: BeforeEndTarget;
  /** Les règles ciblées, dans l'ordre : la PREMIÈRE qui vise gagne. */
  beforeEndRules: BeforeEndRule[];
}

export interface PlaybackSettings {
  intro: SegmentSettings;
  /** Générique de fin d'un ÉPISODE. */
  outro: SegmentSettings;
  /**
   * Générique de fin d'un FILM — un réglage à lui, et il le faut.
   *
   * Sur un épisode, le générique de fin est occupé par la fiche « à suivre » :
   * le bouton n'y paraît que s'il mène ailleurs, et le passer d'office
   * entrerait en concurrence avec l'enchaînement. Sur un film il n'y a rien
   * d'autre, et « passer le générique » veut dire soit rejoindre la scène
   * post-générique, soit terminer — deux gestes qu'on ne règle pas comme on
   * règle un épisode.
   */
  outroFilm: SegmentSettings;
  recap: SegmentSettings;
  preview: SegmentSettings;
  next: NextEpisodeSettings;
}

/**
 * Cinq secondes : le temps de voir la pilule et de s'y opposer sans avoir à
 * guetter l'écran. C'était trois ; l'usage a tranché pour cinq.
 */
export const SEGMENT_AUTO_DELAY_DEFAULT_MS = 5_000;
export const SEGMENT_AUTO_DELAY_MAX_MS = 30_000;

/**
 * Le compte à rebours livré. Dix secondes : le temps de lire le titre de
 * l'épisode suivant et de dire non.
 */
export const NEXT_COUNTDOWN_DEFAULT_MS = 10_000;
/** En deçà, la fiche n'aurait pas le temps d'être lue. */
export const NEXT_COUNTDOWN_MIN_MS = 1_000;
export const NEXT_COUNTDOWN_MAX_MS = 60_000;

export const NEXT_BEFORE_END_SECONDS_MIN = 5;
export const NEXT_BEFORE_END_SECONDS_MAX = 300;
/** Sous 50 %, ce n'est plus « avant la fin » — c'est le milieu du média. */
export const NEXT_BEFORE_END_PERCENT_MIN = 50;
export const NEXT_BEFORE_END_PERCENT_MAX = 100;

/**
 * Quatre-vingt-dix-huit pour cent : le seuil global livré.
 *
 * Une proportion plutôt qu'une durée, parce qu'elle vaut pour les deux
 * formats du foyer sans réglage — quarante secondes sur un épisode d'une
 * heure, vingt-huit sur un animé de vingt-trois minutes.
 */
export const BEFORE_END_DEFAULT: BeforeEndTarget = { mode: "percent", value: 98 };

/** Au-delà, la liste de règles devient un formulaire, plus un réglage. */
export const BEFORE_END_MAX_RULES = 12;

/**
 * Les défauts LIVRÉS — et ce sont exactement ceux du préréglage « Par
 * défaut » (`playbackPresets.ts`), pas un second jeu de valeurs à tenir en
 * parallèle.
 *
 * Ce qu'ils disent : le début d'épisode et l'aperçu du suivant se passent
 * seuls après cinq secondes (avec leur décompte, donc réfutables) ; le résumé
 * et le générique de fin se PROPOSENT, parce que les sauter d'office prive
 * d'un rappel utile et d'une scène post-générique ; l'épisode suivant
 * s'enchaîne.
 *
 * Ils s'appliquent aux comptes qui n'ont jamais rien réglé. Une ligne en base
 * veut dire « cet utilisateur a choisi » : elle n'est jamais écrasée.
 */
export const DEFAULT_PLAYBACK_SETTINGS: PlaybackSettings = {
  intro: { action: "auto", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  outro: { action: "button", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  // Le film passe son générique TOUT SEUL, et c'est sans danger par
  // construction : quand rien ne suit le générique, « passer » voudrait dire
  // quitter le film, et le bouton s'impose alors quel que soit ce réglage
  // (`skipCandidate.ts`). L'automatique ne sert donc qu'à rejoindre une scène
  // post-générique — ou à terminer, une fois cette scène passée.
  outroFilm: { action: "auto", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  recap: { action: "button", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  preview: { action: "auto", countdownVisible: true, autoDelayMs: SEGMENT_AUTO_DELAY_DEFAULT_MS },
  next: {
    nextCard: true,
    nextCountdown: true,
    nextCountdownMs: NEXT_COUNTDOWN_DEFAULT_MS,
    nextAutoPlay: true,
    nextTrigger: "outroStart",
    beforeEndEnabled: true,
    beforeEndDefault: { ...BEFORE_END_DEFAULT },
    beforeEndRules: [],
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

function normalizeTarget(raw: unknown, defaults: BeforeEndTarget): BeforeEndTarget {
  if (typeof raw !== "object" || raw === null) return { ...defaults };
  const o = raw as Record<string, unknown>;
  const mode: BeforeEndMode = o.mode === "seconds" || o.mode === "percent" ? o.mode : defaults.mode;
  const [min, max] =
    mode === "percent"
      ? [NEXT_BEFORE_END_PERCENT_MIN, NEXT_BEFORE_END_PERCENT_MAX]
      : [NEXT_BEFORE_END_SECONDS_MIN, NEXT_BEFORE_END_SECONDS_MAX];
  const fallback = defaults.mode === mode ? defaults.value : mode === "percent" ? 98 : 45;
  return { mode, value: clampInt(o.value, min, max, fallback) };
}

function normalizeRules(raw: unknown): BeforeEndRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: BeforeEndRule[] = [];
  for (const entry of raw.slice(0, BEFORE_END_MAX_RULES)) {
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    const libraryIds = Array.isArray(o.libraryIds)
      ? [...new Set(o.libraryIds.filter((id): id is string => typeof id === "string" && id !== ""))]
      : [];
    // Une règle sans cible ne s'applique à rien : elle ne survit pas au tour.
    if (libraryIds.length === 0) continue;
    rules.push({ libraryIds, ...normalizeTarget(o, BEFORE_END_DEFAULT) });
  }
  return rules;
}

function normalizeNext(raw: unknown, defaults: NextEpisodeSettings): NextEpisodeSettings {
  if (typeof raw !== "object" || raw === null) return { ...defaults, beforeEndRules: [] };
  const o = raw as Record<string, unknown>;
  // Migration douce : un cache ou une ligne d'avant porte `nextBeforeEndSeconds`
  // et rien d'autre. On le convertit une fois, au lieu d'écraser son choix.
  const legacy = o.beforeEndDefault === undefined && typeof o.nextBeforeEndSeconds === "number"
    ? { mode: "seconds" as const, value: o.nextBeforeEndSeconds }
    : o.beforeEndDefault;
  return {
    nextCard: booleanField(o.nextCard, defaults.nextCard),
    nextCountdown: booleanField(o.nextCountdown, defaults.nextCountdown),
    nextCountdownMs: clampInt(
      o.nextCountdownMs,
      NEXT_COUNTDOWN_MIN_MS,
      NEXT_COUNTDOWN_MAX_MS,
      defaults.nextCountdownMs,
    ),
    nextAutoPlay: booleanField(o.nextAutoPlay, defaults.nextAutoPlay),
    nextTrigger:
      o.nextTrigger === "outroStart" || o.nextTrigger === "beforeEnd"
        ? o.nextTrigger
        : defaults.nextTrigger,
    beforeEndEnabled: booleanField(o.beforeEndEnabled, defaults.beforeEndEnabled),
    beforeEndDefault: normalizeTarget(legacy, defaults.beforeEndDefault),
    beforeEndRules: normalizeRules(o.beforeEndRules),
  };
}

/**
 * Le seuil qui s'applique à CETTE bibliothèque — `null` quand le repli est
 * éteint. La PREMIÈRE règle qui vise l'emporte : l'ordre de la liste est le
 * seul arbitre, et il est sous les yeux de l'utilisateur.
 */
export function resolveBeforeEnd(
  next: NextEpisodeSettings,
  libraryId: string | null,
): BeforeEndTarget | null {
  if (!next.beforeEndEnabled) return null;
  if (libraryId !== null) {
    for (const rule of next.beforeEndRules) {
      if (rule.libraryIds.includes(libraryId)) return { mode: rule.mode, value: rule.value };
    }
  }
  return { ...next.beforeEndDefault };
}

/**
 * La position, en ms, à partir de laquelle la suite se propose. `null` quand
 * la durée est inconnue — on ne devine pas une fin qu'on ne connaît pas.
 */
export function beforeEndPositionMs(
  target: BeforeEndTarget,
  runtimeMs: number,
): number | null {
  if (runtimeMs <= 0) return null;
  return target.mode === "percent"
    ? Math.round((runtimeMs * target.value) / 100)
    : Math.max(0, runtimeMs - target.value * 1000);
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
    outroFilm: normalizeSegment(o.outroFilm, d.outroFilm),
    recap: normalizeSegment(o.recap, d.recap),
    preview: normalizeSegment(o.preview, d.preview),
    next: normalizeNext(o.next, d.next),
  };
}
