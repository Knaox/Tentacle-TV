import { useEffect, useSyncExternalStore } from "react";
import type { BootScreenState } from "@tentacle-tv/tv-core/boot";

/**
 * Ce que l'app DIT à l'ouverture du démarrage pendant qu'elle se joue :
 * l'écran affiché, ce que les écrans qui chargent disent d'eux-mêmes (prêt, en
 * échec), si un écran bloquant veut paraître (hors ligne, migration de la
 * base, accès suspendu). Un magasin à part (les écrans ne connaissent pas
 * l'ouverture) ; la règle qui en tire « attendre, partir, renoncer » est dans
 * tv-core (`bootIntroOutcome`). Hors ouverture, rien ne le lit.
 */
export interface BootIntroReport {
  /** L'ouverture se joue : rien d'autre ne doit sonner ni jouer (l'aperçu de la zone attend). */
  playing: boolean;
  /** L'écran affiché (null : la navigation n'est pas encore prête). */
  route: string | null;
  /** Ce que disent d'eux-mêmes les écrans qui chargent (l'accueil, « Qui regarde ? »), par route. */
  screens: Readonly<Record<string, BootScreenState>>;
  blocked: boolean;
}

let report: BootIntroReport = { playing: false, route: null, screens: {}, blocked: false };
const listeners = new Set<() => void>();

function update(next: BootIntroReport): void {
  if (next.playing === report.playing && next.route === report.route && next.screens === report.screens && next.blocked === report.blocked) return;
  report = next;
  listeners.forEach((listener) => listener());
}

export const bootIntroGate = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot: (): BootIntroReport => report,
  /** Un écran qui charge dit où il en est : `loading`, `ready` (montré d'un bloc), `failed`. */
  reportScreen(route: string, state: BootScreenState): void {
    if (report.screens[route] === state) return;
    update({ ...report, screens: { ...report.screens, [route]: state } });
  },
  /** L'ouverture commence, ou est arrivée (renoncement compris). */
  reportPlaying(playing: boolean): void {
    update({ ...report, playing });
  },
  reportBlocked(blocked: boolean): void {
    update({ ...report, blocked });
  },
  /** L'écran affiché, à chaque changement de la navigation. */
  reportRoute(name: string | undefined): void {
    if (name !== undefined) update({ ...report, route: name });
  },
};

export function useBootIntroReport(): BootIntroReport {
  return useSyncExternalStore(bootIntroGate.subscribe, bootIntroGate.snapshot, bootIntroGate.snapshot);
}

/** L'ouverture se joue (l'aperçu de bande-annonce de la zone attend son arrivée). */
export function useBootIntroPlaying(): boolean {
  return useSyncExternalStore(bootIntroGate.subscribe, () => report.playing, () => report.playing);
}

/** Un écran qui charge dit où il en est (un effet : la porte n'est pas lue pendant son rendu). */
export function useReportScreenToBootIntro(route: string, state: BootScreenState): void {
  useEffect(() => {
    bootIntroGate.reportScreen(route, state);
  }, [route, state]);
}

/** La racine de l'app dit si un écran bloquant veut paraître. */
export function useReportBlockedToBootIntro(blocked: boolean): void {
  useEffect(() => {
    bootIntroGate.reportBlocked(blocked);
  }, [blocked]);
}
