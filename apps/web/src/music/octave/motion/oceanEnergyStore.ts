/**
 * Octave — UN relevé du niveau pour toutes les houles à l'écran. Tant qu'au
 * moins une houle roule (`run` : musique en lecture, à l'écran, fenêtre
 * visible, mouvement non réduit), le niveau est demandé cinq fois par
 * seconde à la source (au bureau : `audio_level`, mpv) ; personne : plus une
 * seule demande. Chaque mesure passe par la règle pure (`oceanEnergy.ts`), et
 * les houles ne reçoivent qu'un changement qui compte (un centième de facteur).
 *
 * Sans source (le web : le moteur `<audio>` n'expose aucun graphe audio — on
 * ne décode JAMAIS le flux une seconde fois), aucune demande : la houle garde
 * son allure de toujours.
 */

import { invoke } from "../../../desktop/bridge";
import { supportsAudioLevel } from "../../../desktop/capabilities";
import { ENERGY_START, NEUTRAL_DRIVE, driveChanged, driveOf, newTrack, stepEnergy, type EnergyState, type SwellDrive } from "./oceanEnergy";

export const LEVEL_POLL_MS = 200;

/**
 * Le titre change : la houle quitte la rangée d'avant pour celle d'après (un abonné part, un autre arrive
 * dans le même rendu). Dans ce délai, l'énergie est GARDÉE — la mer ne retombe pas à chaque titre.
 */
export const ENERGY_GRACE_MS = 3_000;

export type LevelSource = () => Promise<number | null>;

function platformSource(): LevelSource | null {
  return supportsAudioLevel() ? () => invoke<number | null>("audio_level") : null;
}

export interface EnergyClock {
  now: () => number;
  every: (fn: () => void, ms: number) => () => void;
}

const realClock: EnergyClock = {
  now: () => performance.now(),
  every: (fn, ms) => {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  },
};

/** Le relevé (une instance pour l'application ; les tests en font une à eux). */
export function createEnergyStore(source: () => LevelSource | null, clock: EnergyClock) {
  const listeners = new Set<(drive: SwellDrive) => void>();
  let state: EnergyState = ENERGY_START;
  let drive: SwellDrive = NEUTRAL_DRIVE;
  let stop: (() => void) | null = null;
  let inFlight = false;
  let last = 0;
  /** L'instant où le dernier abonné est parti (`null` : quelqu'un écoute, ou jamais parti). */
  let leftAt: number | null = null;
  let trackKey: string | null = null;

  async function tick(read: LevelSource): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    try {
      const level = await read().catch(() => null);
      const now = clock.now();
      state = stepEnergy(state, level, now - last);
      last = now;
      const next = level === null ? drive : driveOf(state.energy);
      if (!driveChanged(next, drive)) return;
      drive = next;
      for (const listener of listeners) listener(drive);
    } finally {
      inFlight = false;
    }
  }

  function start(): void {
    const read = source();
    if (read === null) return;
    const now = clock.now();
    // Parti depuis trop longtemps : on repart de l'allure de toujours (la moyenne du morceau, elle, est gardée).
    if (leftAt !== null && now - leftAt > ENERGY_GRACE_MS) {
      state = { ...state, energy: ENERGY_START.energy };
      drive = NEUTRAL_DRIVE;
    }
    leftAt = null;
    last = now;
    stop = clock.every(() => void tick(read), LEVEL_POLL_MS);
  }

  return {
    /** Une houle qui roule s'abonne ; elle reçoit aussitôt l'état du moment. */
    subscribe(listener: (drive: SwellDrive) => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) start();
      listener(drive);
      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) return;
        stop?.();
        stop = null;
        leftAt = clock.now();
      };
    },
    /** Le titre qui joue : un nouveau titre a sa propre moyenne (le niveau est normalisé sur LUI). */
    noteTrack(key: string | null): void {
      if (key === trackKey) return;
      trackKey = key;
      state = newTrack(state);
    },
    /** Pour les tests : le relevé tourne-t-il ? */
    polling: (): boolean => stop !== null,
  };
}

export const oceanEnergy = createEnergyStore(platformSource, realClock);
