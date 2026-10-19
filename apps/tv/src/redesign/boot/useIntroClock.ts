import { useCallback, useEffect, useMemo } from "react";
import { runOnJS, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { INTRO_HOLD_AT, INTRO_TIMING } from "@tentacle-tv/shared/brandIntro";
import { BOOT_INTRO_IDLE_FADE_MS, BOOT_SOUND_FILE_AT, bootSoundLeads } from "@tentacle-tv/tv-core/boot";
import type { IntroClock } from "./introWorklets";

/** Les états de l'horloge (des nombres : ils vivent sur le fil d'interface). */
export const CLOCK = { running: 0, holding: 1, releasing: 2, done: 3, stopped: 4 } as const;

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
}

/**
 * L'HORLOGE de l'ouverture, sur le fil d'interface (Reanimated) : elle avance
 * image par image, s'arrête juste avant l'appui tant que `ready` est faux (les
 * boucles de l'attente jouent alors sur `idle`), et repart dès qu'il passe à
 * vrai — après un court délai qui laisse au son le temps d'être programmé à
 * l'heure exacte de l'appui. Le JavaScript du démarrage n'y prend aucune part.
 * `frozenAt` (le banc) : l'horloge reste figée à cet instant.
 */
export function useIntroClock(events: IntroClockEvents, frozenAt: number | null = null): IntroClockControl {
  const scene = useSharedValue(frozenAt ?? 0);
  const idle = useSharedValue(0);
  const idleWeight = useSharedValue(0);
  const landed = useSharedValue(0);
  const ready = useSharedValue(false);
  const state = useSharedValue<number>(frozenAt === null ? CLOCK.running : CLOCK.stopped);
  const last = useSharedValue(-1);
  const releaseAt = useSharedValue(0);
  const soundAsked = useSharedValue(false);
  const defaults = bootSoundLeads(null);
  const requestAt = useSharedValue(defaults.requestAt);
  const releaseDelay = useSharedValue(defaults.releaseDelayMs);
  const { onHold, onSound, onDone } = events;

  const frame = useFrameCallback((info) => {
    "worklet";
    const now = info.timestamp;
    const previous = last.value;
    last.value = now;
    if (previous < 0 || state.value === CLOCK.done || state.value === CLOCK.stopped) return;
    const elapsed = now - previous;
    if (state.value === CLOCK.holding) {
      idle.value += elapsed;
      if (!ready.value) return;
      // L'accueil est prêt : le son est programmé d'abord, l'image reprend un peu après.
      state.value = CLOCK.releasing;
      releaseAt.value = now + releaseDelay.value;
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
      soundAsked.value = true;
      // `bootSoundStartAt` (tv-core) à la main : une fonction du fil JS ne s'appelle pas d'ici.
      runOnJS(onSound)(now + (BOOT_SOUND_FILE_AT - next));
    }
    if (next >= INTRO_TIMING.end) {
      scene.value = INTRO_TIMING.end;
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
    () => ({ scene, idle, idleWeight, landed, ready, state, requestAt, releaseDelay, stop }),
    [scene, idle, idleWeight, landed, ready, state, requestAt, releaseDelay, stop],
  );
}
