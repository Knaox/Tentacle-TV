import { useEffect, useRef } from "react";
import { NativeModules } from "react-native";

/**
 * Le MODE DE MESURE d'Android TV, côté JS — le module natif `TentaclePerf`
 * (`android/…/perf/`). Éteint par défaut ; allumé par
 * `adb shell setprop debug.tentacle.perf 1` puis une relance de l'app.
 * Éteint, rien ne part vers le natif : chaque fonction s'arrête au drapeau,
 * lu une fois au chargement.
 *
 * Procédure et seuils : `docs/tv-navigation/android-perf.md`.
 */

interface PerfNativeModule {
  enabled?: boolean;
  mark(label: string): void;
  commit(components: number, mounts: number, updates: number): void;
}

const native = NativeModules.TentaclePerf as PerfNativeModule | undefined;

/** Vrai quand le mode de mesure est allumé (propriété système lue au lancement). */
export const PERF_ENABLED: boolean = native?.enabled === true;

/** Une MARQUE dans le journal : elle nomme la fenêtre d'images en cours ou la suivante. */
export function perfMark(label: string): void {
  if (PERF_ENABLED) native?.mark(label);
}

/** Ce qu'une validation React a coûté (`installPerf`). */
export function perfCommit(components: number, mounts: number, updates: number): void {
  if (PERF_ENABLED) native?.commit(components, mounts, updates);
}

/**
 * Un écran PRÊT — son contenu à l'écran, plus de chargement : le journal dit
 * le temps depuis le lancement (le premier) ou depuis l'arrivée sur l'écran.
 * Une fois par montage.
 */
export function usePerfReady(screen: string, ready: boolean): void {
  const said = useRef(false);
  useEffect(() => {
    if (!PERF_ENABLED || !ready || said.current) return;
    said.current = true;
    perfMark(`prêt:${screen}`);
  }, [ready, screen]);
}
