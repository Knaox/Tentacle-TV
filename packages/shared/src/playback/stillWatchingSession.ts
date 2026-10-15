import type { StillWatchingSettings } from "./stillWatchingSettings";

/**
 * « Vous regardez encore ? » — la RÈGLE, pure, horloge injectée : le même
 * minuteur pour le web, le bureau, le mobile et les téléviseurs. L'adaptateur
 * de chaque lecteur ne fait que rapporter les gestes, cadencer `tick` et
 * appliquer la pause demandée.
 *
 * - `watching` : le temps de LECTURE s'accumule (une pause, un chargement ne
 *   comptent pas) ; tout geste le remet à zéro. Le compteur traverse les
 *   épisodes : c'est l'enchaînement sans un geste qui pose la question.
 * - `asking` : l'encart est là, le compte à rebours court ; un geste qui
 *   prouve une présence (une touche, un clic, « Continuer ») ramène à `watching`.
 * - `paused` : le compte à rebours a expiré, la lecture est mise en pause et
 *   l'encart dit « Lecture en pause ». On en sort en RELANÇANT la lecture —
 *   par « Reprendre » ou par n'importe quel autre chemin —, jamais par un
 *   simple geste : il faut pouvoir cliquer « Reprendre » sans que l'encart
 *   disparaisse sous le pointeur.
 */

export type StillWatchingPhase = "watching" | "asking" | "paused";

export interface StillWatchingSession {
  phase: StillWatchingPhase;
  /** Le temps de lecture accumulé depuis le dernier geste. */
  watchedMs: number;
  /** Le dernier `tick` où la lecture tournait ; null sinon. */
  lastTickAt: number | null;
  /** Le début de la question. */
  askedAt: number | null;
  /** Le début de la pause demandée. */
  pausedAt: number | null;
}

/**
 * Un écart entre deux `tick` plus long que ceci n'est pas de la lecture :
 * l'appareil dormait, l'onglet était gelé. On n'en compte que ce plafond.
 */
export const STILL_WATCHING_MAX_TICK_GAP_MS = 5_000;

/**
 * Le temps laissé au lecteur pour obéir à la pause. Passé ce délai, une
 * lecture qui tourne en `paused` est une REPRISE voulue (touche média,
 * casque, télécommande Jellyfin) : on ne la combat pas.
 */
export const STILL_WATCHING_PAUSE_GRACE_MS = 3_000;

export function initialStillWatchingSession(): StillWatchingSession {
  return { phase: "watching", watchedMs: 0, lastTickAt: null, askedAt: null, pausedAt: null };
}

export interface StillWatchingTickInput {
  now: number;
  playing: boolean;
  settings: StillWatchingSettings;
}

/** Avance le minuteur. Rend la MÊME session quand rien ne change (comparaison par identité). */
export function stillWatchingTick(session: StillWatchingSession, input: StillWatchingTickInput): StillWatchingSession {
  const { now, playing, settings } = input;
  if (!settings.enabled) {
    return session.phase === "watching" && session.watchedMs === 0 && session.lastTickAt === null ? session : initialStillWatchingSession();
  }
  if (session.phase === "paused") {
    const settled = session.pausedAt !== null && now - session.pausedAt >= STILL_WATCHING_PAUSE_GRACE_MS;
    return playing && settled ? { ...initialStillWatchingSession(), lastTickAt: now } : session;
  }
  if (session.phase === "asking") {
    const expired = session.askedAt !== null && now - session.askedAt >= settings.countdownMs;
    return expired ? { ...session, phase: "paused", pausedAt: now, lastTickAt: null } : session;
  }
  const elapsed = playing && session.lastTickAt !== null ? Math.min(STILL_WATCHING_MAX_TICK_GAP_MS, Math.max(0, now - session.lastTickAt)) : 0;
  const watchedMs = session.watchedMs + elapsed;
  const lastTickAt = playing ? now : null;
  if (watchedMs >= settings.afterMs) {
    return { phase: "asking", watchedMs, lastTickAt: null, askedAt: now, pausedAt: null };
  }
  if (watchedMs === session.watchedMs && lastTickAt === session.lastTickAt) return session;
  return { ...session, watchedMs, lastTickAt };
}

/**
 * Un geste qui prouve une présence. En lecture : le compteur repart de zéro.
 * Pendant la question : c'est une réponse. En pause : rien (voir l'en-tête).
 */
export function stillWatchingActivity(session: StillWatchingSession, now: number): StillWatchingSession {
  if (session.phase === "paused") return session;
  if (session.phase === "watching" && session.watchedMs === 0) return session;
  return { ...initialStillWatchingSession(), lastTickAt: session.phase === "watching" ? session.lastTickAt : now };
}

/** « Continuer » / « Reprendre » : retour à la lecture, compteur à zéro. */
export function stillWatchingContinue(now: number): StillWatchingSession {
  return { ...initialStillWatchingSession(), lastTickAt: now };
}

/** « Mettre en pause » pendant la question : la pause tout de suite, l'encart passe à « Lecture en pause ». */
export function stillWatchingPauseNow(session: StillWatchingSession, now: number): StillWatchingSession {
  return session.phase === "asking" ? { ...session, phase: "paused", pausedAt: now, lastTickAt: null } : session;
}

/** Le lecteur doit-il (encore) être mis en pause ? Seulement pendant le délai de grâce. */
export function stillWatchingNeedsPause(session: StillWatchingSession, playing: boolean, now: number): boolean {
  if (session.phase !== "paused" || !playing || session.pausedAt === null) return false;
  return now - session.pausedAt < STILL_WATCHING_PAUSE_GRACE_MS;
}

/**
 * Le temps qui reste avant la pause, pendant la question ; 0 sinon. Jamais
 * plus que le décompte : une horloge lue AVANT la question (le premier rendu
 * de l'encart garde celle de son dernier battement) ne l'allonge pas — la
 * barre, armée une fois sur ce temps, se viderait bien après la pause.
 */
export function stillWatchingRemainingMs(session: StillWatchingSession, now: number, settings: StillWatchingSettings): number {
  if (session.phase !== "asking" || session.askedAt === null) return 0;
  const elapsed = Math.max(0, now - session.askedAt);
  return Math.max(0, settings.countdownMs - elapsed);
}
