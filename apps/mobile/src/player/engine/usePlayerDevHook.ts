import { useEffect } from "react";
import type { PlayerEngineKind } from "./types";

/** Ce que le crochet de développement expose au débogueur. */
export interface PlayerDevHook {
  engine: PlayerEngineKind;
  audioIndex: number;
  subtitleIndex: number;
  isDirectPlay: boolean;
  changeAudio: (index: number) => void;
  changeSubtitle: (index: number) => void;
  seek: (seconds: number) => void;
  setPaused: (paused: boolean) => void;
  /** Simule un changement de route AirPlay (le simulateur n'en a pas). */
  simulateAirPlay: (active: boolean) => void;
  /** Palier de qualité (« original » désarme le plafond automatique). */
  changeQuality: (key: string) => void;
  /** Lecteur avancé : décodeur, images perdues, journal natif. */
  technicalInfo: () => Promise<Record<string, unknown>>;
  /** Quitter le lecteur, par le même chemin que le bouton Retour. */
  leave: () => void;
}

type DevGlobal = typeof globalThis & { __tentaclePlayer?: PlayerDevHook };

/**
 * Le crochet de DÉVELOPPEMENT du lecteur : `globalThis.__tentaclePlayer`,
 * pilotable depuis l'inspecteur Hermes (Metro, CDP) pour vérifier changements
 * de piste, sauts et pause sans toucher l'écran — les taps injectés au
 * simulateur n'atteignent pas les `Pressable`. Sous `__DEV__` seulement : le
 * bloc disparaît des bundles de production.
 */
export function usePlayerDevHook(hook: PlayerDevHook): void {
  useEffect(() => {
    if (!__DEV__) return;
    const scope = globalThis as DevGlobal;
    scope.__tentaclePlayer = hook;
    return () => {
      if (scope.__tentaclePlayer === hook) delete scope.__tentaclePlayer;
    };
  }, [hook]);
}
