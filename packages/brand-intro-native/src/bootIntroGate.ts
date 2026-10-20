import { useEffect, useSyncExternalStore } from "react";
import type { BootScreenState } from "@tentacle-tv/shared/brandIntro";

/**
 * Ce que l'app DIT à l'ouverture du démarrage pendant qu'elle se joue :
 * l'écran affiché, ce que les écrans qui chargent disent d'eux-mêmes (prêt, en
 * échec), si un écran bloquant veut paraître (hors ligne, migration de la
 * base, accès suspendu). Un magasin à part (les écrans ne connaissent pas
 * l'ouverture) ; la règle qui en tire « attendre, partir » est dans shared
 * (`bootIntroOutcome`). Hors ouverture, rien ne le lit.
 */
export interface BootIntroReport {
  /** L'ouverture se joue : rien d'autre ne doit sonner ni jouer (l'aperçu de la zone attend). */
  playing: boolean;
  /** L'écran affiché (null : la navigation n'est pas encore prête) : le nom de route de la TV, le chemin du mobile. */
  route: string | null;
  /** Ce que disent d'eux-mêmes les écrans qui chargent (l'accueil, « Qui regarde ? »), par route. */
  screens: Readonly<Record<string, BootScreenState>>;
  blocked: boolean;
  /** Un écran qui peut recouvrir le premier n'a pas encore tranché (mobile : « Qui regarde ? », premier lancement). */
  pending: boolean;
  /** L'app a fini de démarrer (mobile : stockage relu, polices chargées) : l'encre peut céder au poulpe. */
  appReady: boolean;
}

let report: BootIntroReport = { playing: false, route: null, screens: {}, blocked: false, pending: false, appReady: false };
const listeners = new Set<() => void>();

function update(next: BootIntroReport): void {
  if (
    next.playing === report.playing &&
    next.route === report.route &&
    next.screens === report.screens &&
    next.blocked === report.blocked &&
    next.pending === report.pending &&
    next.appReady === report.appReady
  ) return;
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
  reportPending(pending: boolean): void {
    update({ ...report, pending });
  },
  reportAppReady(appReady: boolean): void {
    update({ ...report, appReady });
  },
  /** L'écran affiché, à chaque changement de la navigation. */
  reportRoute(name: string | undefined): void {
    if (name !== undefined) update({ ...report, route: name });
  },
};

/**
 * Résolue quand l'ouverture est arrivée (aussitôt si elle ne se joue pas) :
 * pour ce qui ouvre une fenêtre du SYSTÈME (demande de permission), qui se
 * poserait par-dessus le poulpe et rendrait l'app inactive en pleine ouverture.
 */
export function whenBootIntroLanded(): Promise<void> {
  if (!report.playing) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = bootIntroGate.subscribe(() => {
      if (report.playing) return;
      unsubscribe();
      resolve();
    });
  });
}

export function useBootIntroReport(): BootIntroReport {
  return useSyncExternalStore(bootIntroGate.subscribe, bootIntroGate.snapshot, bootIntroGate.snapshot);
}

/**
 * L'ouverture est arrivée, ou ne se joue pas : ce qui s'ouvre PAR-DESSUS
 * l'app au lancement (une modale, une feuille — elles sortent de l'écran du
 * poulpe) attend ce moment.
 */
export function useBootIntroLanded(): boolean {
  return !useBootIntroPlaying();
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
