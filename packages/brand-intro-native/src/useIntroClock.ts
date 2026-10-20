import { useCallback, useEffect, useMemo } from "react";
import { runOnJS, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { INTRO_HOLD_AT, INTRO_TIMING } from "@tentacle-tv/shared/brandIntro";
import { BOOT_INTRO_IDLE_FADE_MS, BOOT_SOUND_FILE_AT, INTRO_START, INTRO_START_FRESH, bootSoundLeads } from "@tentacle-tv/shared/brandIntro";
import { introStartStepWorklet, type IntroClock } from "./introWorklets";

/** Les états de l'horloge (des nombres : ils vivent sur le fil d'interface). */
export const CLOCK = { running: 0, holding: 1, releasing: 2, done: 3, stopped: 4, waiting: 5 } as const;

/**
 * Avant que le son ne soit demandé, une image qui traîne (le fil d'interface
 * pris par le montage de l'accueil) est absorbée au lieu d'être sautée :
 * l'ouverture marque une pause plutôt qu'un saut. Une fois le son programmé,
 * l'horloge suit le temps réel : l'image reste calée sur le « ta-dum ».
 */
const MAX_FRAME_MS = 34;

export interface IntroClockEvents {
  /** L'horloge s'arrête sur le bouton lecture : l'accueil n'est pas prêt. */
  onHold: () => void;
  /** Le fichier du son doit partir à cette heure (horloge des images, ms). */
  onSound: (startAt: number) => void;
  /** La chorégraphie est arrivée au bout. */
  onDone: () => void;
}

export interface IntroClockControl extends IntroClock {
  /** Vrai : l'écran suivant est prêt — l'ouverture appuie, allume, plonge. */
  ready: SharedValue<boolean>;
  state: SharedValue<number>;
  /** Quand demander le son, et la reprise après l'attente (tv-core `bootSoundLeads`, d'après la sortie). */
  requestAt: SharedValue<number>;
  releaseDelay: SharedValue<number>;
  /** Arrivée ou renoncement : l'horloge ne compte plus aucune image. */
  stop: () => void;
  /** L'app a fini de démarrer (mobile, `waitForApp`) : l'encre peut céder au poulpe. */
  appReady: SharedValue<boolean>;
  /**
   * Le journal des images (fil d'interface) : `[phase, écart en ms, …]`, phases de shared
   * `INTRO_FRAME_PHASES` — bilan par `introFrameReport`. Coût : deux nombres par image.
   */
  frameLog: SharedValue<number[]>;
  /**
   * Le relevé à l'heure MURALE (`Date.now()`) pour le banc : chaque trou de plus de 50 ms
   * (`[début, durée, …]`) et les jalons — première image, fin de l'encre, ta-dum, arrivée.
   */
  wallTrace: SharedValue<IntroWallTrace>;
}

/**
 * L'HORLOGE de l'ouverture, sur le fil d'interface (Reanimated) : elle avance
 * image par image, s'arrête juste avant l'appui tant que `ready` est faux (les
 * boucles de l'attente jouent alors sur `idle`), et repart dès qu'il passe à
 * vrai — après un court délai qui laisse au son le temps d'être programmé à
 * l'heure exacte de l'appui. Le JavaScript du démarrage n'y prend aucune part.
 * `frozenAt` (le banc) : l'horloge reste figée à cet instant.
 */
export interface IntroWallTrace {
  stalls: number[];
  firstFrame: number;
  start: number;
  dive: number;
  done: number;
}

/** Un trou de plus que ceci se relève à l'heure murale (le banc le met en face des étapes du démarrage). */
const STALL_MS = 50;

export interface IntroClockOptions {
  /**
   * Rester sur l'encre (immobile) tant que l'app démarre (`appReady`) et que le fil
   * d'interface n'a pas rendu quelques images régulières — shared `introStart`. Mobile.
   */
  waitForApp?: boolean;
  /**
   * Pendant l'encre, tout dessiner d'avance sous un voile (`IntroClock.prewarm`) : Android, où
   * l'accueil découvert à l'allumage figeait la plongée. Seulement avec `waitForApp`.
   */
  prewarmOnInk?: boolean;
}

export function useIntroClock(events: IntroClockEvents, frozenAt: number | null = null, options: IntroClockOptions = {}): IntroClockControl {
  const scene = useSharedValue(frozenAt ?? 0);
  const idle = useSharedValue(0);
  const idleWeight = useSharedValue(0);
  const landed = useSharedValue(0);
  const ready = useSharedValue(false);
  const state = useSharedValue<number>(frozenAt !== null ? CLOCK.stopped : options.waitForApp ? CLOCK.waiting : CLOCK.running);
  const appReady = useSharedValue(false);
  const prewarm = useSharedValue(frozenAt === null && options.waitForApp && options.prewarmOnInk ? 1 : 0);
  const startState = useSharedValue({ ...INTRO_START_FRESH });
  const last = useSharedValue(-1);
  const releaseAt = useSharedValue(0);
  const soundAsked = useSharedValue(false);
  const defaults = bootSoundLeads(null);
  const requestAt = useSharedValue(defaults.requestAt);
  const frameLog = useSharedValue<number[]>([]);
  const wallTrace = useSharedValue<IntroWallTrace>({ stalls: [], firstFrame: 0, start: 0, dive: 0, done: 0 });
  const releaseDelay = useSharedValue(defaults.releaseDelayMs);
  const { onHold, onSound, onDone } = events;

  const markWall = (key: "firstFrame" | "start" | "dive" | "done", at: number) => {
    "worklet";
    wallTrace.modify((trace) => {
      "worklet";
      trace[key] = at;
      return trace;
    }, false);
  };

  const frame = useFrameCallback((info) => {
    "worklet";
    const now = info.timestamp;
    const previous = last.value;
    last.value = now;
    const wall = Date.now();
    if (previous < 0) markWall("firstFrame", wall);
    if (previous < 0 || state.value === CLOCK.done || state.value === CLOCK.stopped) return;
    const elapsed = now - previous;
    // 0 : l'assemblage ; 1 : l'attente sur le bouton (et la reprise) ; 2 : ta-dum et la plongée ; 3 : l'encre du début.
    const waiting = state.value === CLOCK.waiting;
    const phase = waiting ? 3 : state.value === CLOCK.holding || state.value === CLOCK.releasing ? 1 : soundAsked.value || scene.value >= INTRO_HOLD_AT ? 2 : 0;
    frameLog.modify((log) => {
      "worklet";
      log.push(phase, elapsed);
      return log;
    }, false);
    if (elapsed > STALL_MS) wallTrace.modify((trace) => {
      "worklet";
      trace.stalls.push(wall - elapsed, elapsed);
      return trace;
    }, false);
    if (waiting) {
      // L'encre, immobile, tant que l'app démarre : le poulpe ne commence que sur un fil calme.
      const step = introStartStepWorklet(startState.value, elapsed, appReady.value, INTRO_START);
      startState.value = step.state;
      if (step.start) {
        state.value = CLOCK.running;
        // Le voile d'encre se lève et le dessin d'avance cesse dans la MÊME image que le départ.
        prewarm.value = 0;
        markWall("start", wall);
      }
      return;
    }
    if (state.value === CLOCK.holding) {
      idle.value += elapsed;
      if (!ready.value) return;
      // L'accueil est prêt : le son est programmé d'abord, l'image reprend un peu après.
      state.value = CLOCK.releasing;
      releaseAt.value = now + releaseDelay.value;
      markWall("dive", wall);
      soundAsked.value = true;
      runOnJS(onSound)(now + releaseDelay.value + (BOOT_SOUND_FILE_AT - INTRO_HOLD_AT));
      return;
    }
    if (state.value === CLOCK.releasing) {
      idle.value += elapsed;
      idleWeight.value = Math.max(0, 1 - (now - releaseAt.value + releaseDelay.value) / BOOT_INTRO_IDLE_FADE_MS);
      if (now < releaseAt.value) return;
      state.value = CLOCK.running;
      scene.value = INTRO_HOLD_AT + (now - releaseAt.value);
      return;
    }
    const next = scene.value + (soundAsked.value ? elapsed : Math.min(elapsed, MAX_FRAME_MS));
    if (!soundAsked.value && !ready.value && next >= INTRO_HOLD_AT) {
      scene.value = INTRO_HOLD_AT;
      idle.value = 0;
      idleWeight.value = 1;
      state.value = CLOCK.holding;
      runOnJS(onHold)();
      return;
    }
    if (!soundAsked.value && ready.value && next >= requestAt.value) {
      markWall("dive", wall);
      soundAsked.value = true;
      // `bootSoundStartAt` (tv-core) à la main : une fonction du fil JS ne s'appelle pas d'ici.
      runOnJS(onSound)(now + (BOOT_SOUND_FILE_AT - next));
    }
    if (next >= INTRO_TIMING.end) {
      scene.value = INTRO_TIMING.end;
      markWall("done", wall);
      state.value = CLOCK.done;
      runOnJS(onDone)();
      return;
    }
    scene.value = next;
  }, frozenAt === null);

  useEffect(() => () => frame.setActive(false), [frame]);
  const stop = useCallback(() => frame.setActive(false), [frame]);

  // Un objet stable : les effets qui en dépendent ne se rejouent pas à chaque rendu.
  return useMemo(
    () => ({ scene, idle, idleWeight, landed, prewarm, ready, state, requestAt, releaseDelay, stop, frameLog, appReady, wallTrace }),
    [scene, idle, idleWeight, landed, prewarm, ready, state, requestAt, releaseDelay, stop, frameLog, appReady, wallTrace],
  );
}
