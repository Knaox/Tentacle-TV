/**
 * « Vous regardez encore ? » côté React — le même crochet pour le web, le
 * bureau, le mobile et les téléviseurs. La règle est pure
 * (`stillWatchingSession.ts`, shared), le réglage est celui du COMPTE
 * (`stillWatchingStore.ts`, copie locale pour le hors ligne).
 *
 * La SESSION du minuteur est un singleton de module : elle survit au
 * remontage du lecteur quand un épisode en enchaîne un autre — c'est
 * précisément l'enchaînement sans un geste qui doit poser la question. Un
 * lecteur rouvert après une vraie sortie (plus d'une minute hors du lecteur)
 * repart de zéro : on n'y revient pas sans un geste.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  createStillWatchingStore,
  initialStillWatchingSession,
  stillWatchingActivity,
  stillWatchingContinue,
  stillWatchingNeedsPause,
  stillWatchingPauseNow,
  stillWatchingRemainingMs,
  type StillWatchingSession,
  type StillWatchingSettings,
  type StillWatchingSnapshot,
  type StillWatchingStore,
} from "@tentacle-tv/shared";
import { useTentacleConfig } from "../context";
import type { StorageAdapter } from "../storage";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapabilities } from "../hooks/useServerCapabilities";
import { tickWithStillWatchingTrial } from "./stillWatchingTrialStore";

const ROUTE = "/api/preferences/still-watching";
/** Une relecture par demi-minute suffit — chaque montage n'en refait pas une. */
const RESYNC_MIN_INTERVAL_MS = 30_000;
/** Hors du lecteur plus longtemps que ceci : ce n'est plus un enchaînement, le compteur repart. */
const REENTRY_RESET_MS = 60_000;
const TICK_MS = 1_000;
/** Le décompte se redessine plus souvent que le minuteur ne bat. */
const COUNTDOWN_REFRESH_MS = 250;

let store: StillWatchingStore | null = null;
let lastResync = 0;

export function initStillWatchingStore(storage: StorageAdapter): StillWatchingStore {
  if (!store) {
    store = createStillWatchingStore({
      storage,
      readRemote: () => tentacleApiFetch<unknown>(ROUTE),
      writeRemote: async (settings) => {
        await tentacleApiFetch(ROUTE, { method: "PUT", body: JSON.stringify(settings) });
      },
    });
  }
  return store;
}

/** Un autre appareil du compte a changé le réglage (`preferences:update`, portée `still-watching`). */
export function resyncStillWatching(): void {
  lastResync = Date.now();
  void store?.resync();
}

/** Android TV : à appeler après l'hydrate() du stockage natif. */
export function rehydrateStillWatching(): void {
  store?.rehydrate();
}

export interface StillWatchingSettingsState extends StillWatchingSnapshot {
  /** Le serveur déclare la capacité : l'écran de réglages peut montrer l'option. */
  available: boolean;
  set: (patch: Partial<StillWatchingSettings>) => void;
}

/**
 * Le réglage du compte, réactif — relu (borné) face à un serveur qui déclare
 * `playback.stillWatching`, éteint face à un serveur qui ne la déclare pas.
 * Hors ligne, la copie locale répond.
 */
export function useStillWatchingSettings(): StillWatchingSettingsState {
  const { storage } = useTentacleConfig();
  const current = initStillWatchingStore(storage);
  const { capabilities, known } = useServerCapabilities();
  const available = capabilities.has("playback.stillWatching");

  useEffect(() => {
    if (!known) return;
    if (!available) {
      current.markUnsupported();
      return;
    }
    const now = Date.now();
    if (now - lastResync < RESYNC_MIN_INTERVAL_MS) return;
    lastResync = now;
    void current.resync();
  }, [current, known, available]);

  const snapshot = useSyncExternalStore(current.subscribe, current.readSnapshot, current.readSnapshot);
  const set = useCallback((patch: Partial<StillWatchingSettings>) => current.set(patch), [current]);
  return { ...snapshot, available, set };
}

// ── La session du minuteur ──────────────────────────────────────────────────

let session: StillWatchingSession = initialStillWatchingSession();
let lastUnmountAt: number | null = null;
const sessionListeners = new Set<() => void>();

function setSession(next: StillWatchingSession): void {
  if (next === session) return;
  const phaseChanged = next.phase !== session.phase;
  session = next;
  // Un geste remet le compteur à zéro à chaque mouvement : seul un changement de PHASE redessine.
  if (phaseChanged) sessionListeners.forEach((listener) => listener());
}

const subscribeSession = (callback: () => void) => {
  sessionListeners.add(callback);
  return () => {
    sessionListeners.delete(callback);
  };
};
const readPhase = () => session.phase;

interface TickSources {
  playing: boolean;
  settings: StillWatchingSettings;
  pause: () => void;
}

/** Un battement du minuteur : la session avance, et la pause qu'elle demande est appliquée. */
function runTick({ playing, settings, pause }: TickSources): void {
  const now = Date.now();
  // « Essayer », dans les Réglages : la question avancée, une fois (`stillWatchingTrialStore.ts`).
  setSession(tickWithStillWatchingTrial(session, { now, playing, settings }));
  if (stillWatchingNeedsPause(session, playing, now)) pause();
}

/** Pour les bancs et les tests : repartir d'une session vierge. */
export function resetStillWatchingSession(): void {
  lastUnmountAt = null;
  setSession(initialStillWatchingSession());
}

export interface UseStillWatchingOptions {
  /** La lecture tourne (ni pause, ni chargement). */
  playing: boolean;
  /** Faux : la fonction se tait (séance Watch Together, lecteur caché…). */
  enabled?: boolean;
  /** Mettre le lecteur en pause. */
  pause: () => void;
  /** Relancer la lecture (« Reprendre »). */
  play: () => void;
}

export interface StillWatchingController {
  /** `none` : rien à montrer ; `asking` : « Vous regardez encore ? » ; `paused` : « Lecture en pause ». */
  phase: "none" | "asking" | "paused";
  /** Le temps qui reste avant la pause, pendant la question. */
  remainingMs: number;
  /** La durée totale du décompte (pour une barre de progression). */
  countdownMs: number;
  /** Un geste qui prouve une présence (touche, clic, mouvement, télécommande). */
  reportActivity: () => void;
  /** « Continuer » pendant la question. */
  keepWatching: () => void;
  /** « Mettre en pause » pendant la question. */
  pauseNow: () => void;
  /** « Reprendre » après la pause. */
  resume: () => void;
}

export function useStillWatching(options: UseStillWatchingOptions): StillWatchingController {
  const { playing, enabled = true } = options;
  const { supported, settings } = useStillWatchingSettings();
  const active = enabled && supported && settings.enabled;

  const latest = useRef({ playing, settings, pause: options.pause, play: options.play });
  latest.current = { playing, settings, pause: options.pause, play: options.play };

  // Une vraie rentrée dans le lecteur repart de zéro ; un épisode qui en enchaîne un autre, non.
  useEffect(() => {
    if (lastUnmountAt === null || Date.now() - lastUnmountAt > REENTRY_RESET_MS) setSession(initialStillWatchingSession());
    return () => {
      lastUnmountAt = Date.now();
    };
  }, []);

  useEffect(() => {
    if (!active) {
      setSession(initialStillWatchingSession());
      return;
    }
    const timer = setInterval(() => runTick(latest.current), TICK_MS);
    return () => clearInterval(timer);
  }, [active]);

  const phase = useSyncExternalStore(subscribeSession, readPhase, readPhase);

  // L'échéance de la question tombe ENTRE deux battements : un battement de plus, posé
  // dessus, met la pause à l'instant où la barre se vide — pas jusqu'à une seconde après.
  useEffect(() => {
    if (!active || phase !== "asking") return;
    const timer = setTimeout(() => runTick(latest.current), stillWatchingRemainingMs(session, Date.now(), latest.current.settings));
    return () => clearTimeout(timer);
  }, [active, phase]);

  // Le décompte affiché : une horloge qui ne bat que pendant la question.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== "asking") return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), COUNTDOWN_REFRESH_MS);
    return () => clearInterval(timer);
  }, [phase]);

  const reportActivity = useCallback(() => {
    setSession(stillWatchingActivity(session, Date.now()));
  }, []);
  const keepWatching = useCallback(() => {
    setSession(stillWatchingContinue(Date.now()));
  }, []);
  const pauseNow = useCallback(() => {
    setSession(stillWatchingPauseNow(session, Date.now()));
    latest.current.pause();
  }, []);
  const resume = useCallback(() => {
    setSession(stillWatchingContinue(Date.now()));
    latest.current.play();
  }, []);

  const shown = active && phase !== "watching" ? phase : "none";
  return {
    phase: shown,
    remainingMs: shown === "asking" ? stillWatchingRemainingMs(session, clock, settings) : 0,
    countdownMs: settings.countdownMs,
    reportActivity,
    keepWatching,
    pauseNow,
    resume,
  };
}
