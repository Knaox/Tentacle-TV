import { useEffect, useSyncExternalStore } from "react";

/**
 * Ce que l'app DIT à l'ouverture du démarrage pendant qu'elle se joue : où en
 * est l'accueil (prêt, en échec), si un écran bloquant veut paraître (hors
 * ligne, migration de la base, accès suspendu), si la navigation a quitté
 * l'accueil. Un magasin à part (les écrans ne connaissent pas l'ouverture) ;
 * la règle qui en tire « attendre, partir, renoncer » est dans tv-core
 * (`bootIntroOutcome`). Hors ouverture, rien ne le lit.
 */
export interface BootIntroReport {
  homeReady: boolean;
  homeFailed: boolean;
  blocked: boolean;
  leftHome: boolean;
}

let report: BootIntroReport = { homeReady: false, homeFailed: false, blocked: false, leftHome: false };
const listeners = new Set<() => void>();

function update(patch: Partial<BootIntroReport>): void {
  const next = { ...report, ...patch };
  if (Object.keys(next).every((key) => next[key as keyof BootIntroReport] === report[key as keyof BootIntroReport])) return;
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
  /** L'accueil s'est montré d'un bloc, ou dit qu'il n'a pas pu se charger. */
  reportHome(ready: boolean, failed: boolean): void {
    update({ homeReady: ready, homeFailed: failed });
  },
  reportBlocked(blocked: boolean): void {
    update({ blocked });
  },
  /** L'écran affiché : un autre que l'accueil, et l'ouverture n'a plus d'accueil où plonger. */
  reportRoute(name: string | undefined): void {
    if (name !== undefined) update({ leftHome: name !== "Home" });
  },
};

export function useBootIntroReport(): BootIntroReport {
  return useSyncExternalStore(bootIntroGate.subscribe, bootIntroGate.snapshot, bootIntroGate.snapshot);
}

/** L'accueil dit où il en est (un effet : la porte n'est pas lue pendant son rendu). */
export function useReportHomeToBootIntro(ready: boolean, failed: boolean): void {
  useEffect(() => {
    bootIntroGate.reportHome(ready, failed);
  }, [ready, failed]);
}

/** La racine de l'app dit si un écran bloquant veut paraître. */
export function useReportBlockedToBootIntro(blocked: boolean): void {
  useEffect(() => {
    bootIntroGate.reportBlocked(blocked);
  }, [blocked]);
}
