/**
 * Octave — ce qu'`App.tsx` demande au lancement en Octave :
 * - l'ATTENTE (statut du serveur au web) : le fond de l'application, la même
 *   encre que celle d'Octave (`--oc-ink` = `--surface-0`), rien d'autre — ni
 *   anneau, ni logo, ni animation ; hors d'un lancement en Octave, l'anneau
 *   d'avant ;
 * - le RELÂCHEMENT : une page de Tentacle (hors l'accueil, que la porte
 *   d'Octave tranche, et hors Octave) ne retient plus rien de Tentacle.
 */

import { useEffect } from "react";
import { PageSpinner } from "../../../components/PageSpinner";
import { OCTAVE_BASE_PATH } from "./octaveMode";
import { releaseTentacle, wasLaunchedInOctave } from "./octaveLaunchStore";

export function OctaveLaunchBackdrop() {
  return <div className="fixed inset-0 bg-surface-0" aria-busy="true" />;
}

/** L'attente du démarrage : le fond d'Octave sur un lancement en Octave, sinon l'anneau. */
export function LaunchWait() {
  return wasLaunchedInOctave() ? <OctaveLaunchBackdrop /> : <PageSpinner />;
}

export function useTentacleRelease(pathname: string): void {
  useEffect(() => {
    if (pathname !== "/" && !pathname.startsWith(OCTAVE_BASE_PATH)) releaseTentacle();
  }, [pathname]);
}
