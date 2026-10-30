/**
 * Octave (mobile) — ce que la vague et les taches du fond lisent du SON : le niveau réel que mesure le moteur
 * natif (`audio_level` : Android `LevelMeter`, iOS `OctaveOutputMeter.c`), dix fois par seconde, et SEULEMENT tant que le lecteur plein écran
 * est ouvert, au premier plan, en lecture et sans mouvement réduit (`active`). Chaque mesure passe par la règle
 * pure (`stepWave`) puis rejoint le fil d'interface en valeurs partagées, lissées sur l'intervalle : aucun rendu
 * React. Sans mesure (ancien build sans compteur), `measured` reste à 0 et rien n'est inventé.
 */

import { useEffect, useRef } from "react";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { isOctaveAudioAvailable, octaveAudioBridge } from "../../../../modules/octave-audio";
import { usePlayerSelector } from "../OctavePlayerContext";
import { WAVE_START, stepWave, waveNewTrack, type WaveState } from "./waveDrive";

/** L'intervalle des mesures (ms) : celui de la houle du bureau, en deux fois plus vif (une crête dure ~300 ms). */
export const WAVE_POLL_MS = 100;
/** Tant de mesures vides d'affilée : la mesure est dite absente (fondu vers le calme). */
const MISSING_AFTER = 5;
/** Au-delà (2 s sans mesure : ancien build), une question par seconde seulement, au cas où le son revient. */
const IDLE_AFTER = 20;
const IDLE_EVERY = 10;
const FADE_MS = 400;

export interface EngineWave {
  energy: SharedValue<number>;
  punch: SharedValue<number>;
  /** 1 tant que le moteur mesure, 0 sinon (en fondu). */
  measured: SharedValue<number>;
}

const STEP = { duration: WAVE_POLL_MS, easing: Easing.linear };

export function useEngineWave(active: boolean): EngineWave {
  const energy = useSharedValue(WAVE_START.energy.energy);
  const punch = useSharedValue(0);
  const measured = useSharedValue(0);
  const state = useRef<WaveState>(WAVE_START);
  const trackKey = usePlayerSelector((s) => s.current?.key ?? null);

  useEffect(() => {
    state.current = waveNewTrack(state.current);
  }, [trackKey]);

  useEffect(() => {
    if (!active || !isOctaveAudioAvailable()) {
      measured.value = withTiming(0, { duration: FADE_MS });
      punch.value = withTiming(0, { duration: FADE_MS });
      return;
    }
    let alive = true;
    let inFlight = false;
    let missing = 0;
    let tick = 0;
    let last = Date.now();
    const read = async () => {
      if (inFlight) return;
      if (missing >= IDLE_AFTER && tick++ % IDLE_EVERY !== 0) return;
      inFlight = true;
      const level = await octaveAudioBridge.invoke<number | null>("audio_level").catch(() => null);
      inFlight = false;
      if (!alive) return;
      const now = Date.now();
      const dt = now - last;
      last = now;
      if (typeof level !== "number") {
        missing++;
        if (missing === MISSING_AFTER) {
          measured.value = withTiming(0, { duration: FADE_MS });
          punch.value = withTiming(0, { duration: FADE_MS });
        }
        return;
      }
      if (missing >= MISSING_AFTER || measured.value === 0) measured.value = withTiming(1, { duration: FADE_MS });
      missing = 0;
      tick = 0;
      state.current = stepWave(state.current, level, dt);
      energy.value = withTiming(state.current.energy.energy, STEP);
      punch.value = withTiming(state.current.punch, STEP);
    };
    const timer = setInterval(() => void read(), WAVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [active, energy, punch, measured]);

  return { energy, punch, measured };
}
