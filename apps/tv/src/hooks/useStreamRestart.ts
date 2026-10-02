import { useCallback, useRef } from "react";
import { plog } from "../utils/playerDiag";
import type { RestartAt, RestartOptions, RestartOutcome } from "./streamRestart";

/**
 * `restartStream`, la relance du flux exposée par `usePlayerStreamPipeline`
 * (contrat : `streamRestart.ts`), habillée en rechargement DOUX : le lecteur
 * reste monté et tenu en pause (`holdForReload`, qui garde aussi l'état de
 * chargement), l'image figée de la position couvre le noir d'AVPlayer, et
 * l'écran de chargement ne revient pas. Le tout se lève au premier rendu du
 * nouveau flux, comme un changement de piste.
 *
 * Le flux SORTANT ne doit plus rien valider : sa progression levait la pause
 * de rechargement avant l'arrivée de la nouvelle URL (mesuré : l'ancienne
 * session rejouait 350 ms, sans image figée). D'où, dès l'appel, la même
 * remise à zéro qu'un changement de source : chargé = faux, fenêtre de
 * convergence armée sur `at`.
 *
 * Une recherche faite PENDANT la réouverture (`noteSeek`) déplace la cible :
 * la nouvelle source part de là — son URL se lit à l'émission —, et l'image
 * figée la suit. Sans cela, la source rouverte repartait de la position
 * d'avant et le saut était perdu.
 *
 * Une relance à la fois. Un échec rend la main sans rien laisser derrière :
 * ni image figée, ni pause de rechargement, ni fenêtre de convergence.
 */
export function useStreamRestart(args: {
  /** La relance de la variante de plateforme (`useTVStreamUrl`). */
  restart: (at: RestartAt, opts?: { keepSession?: boolean }) => Promise<RestartOutcome>;
  positionRef: React.MutableRefObject<number>;
  softReloadRef: React.MutableRefObject<boolean>;
  setReloadFrameSec: (sec: number | null) => void;
  holdForReload: () => void;
  setIsLoading: (loading: boolean) => void;
  resetLoadedRef: React.MutableRefObject<() => void>;
  notifySeekRef: React.MutableRefObject<(target: number, windowMs?: number, afterReload?: boolean) => void>;
}): {
  restartStream: (opts?: RestartOptions) => Promise<RestartOutcome>;
  /** Une recherche vient d'être demandée : pendant une réouverture, elle devient la cible. */
  noteSeek: (target: number) => void;
} {
  const {
    positionRef, softReloadRef, setReloadFrameSec, holdForReload, setIsLoading, resetLoadedRef, notifySeekRef,
  } = args;
  const restartRef = useRef(args.restart);
  restartRef.current = args.restart;
  const inFlightRef = useRef(false);
  // La cible de la réouverture en vol : `at`, puis la dernière recherche.
  const targetRef = useRef(0);

  const noteSeek = useCallback((target: number) => {
    if (!inFlightRef.current) return;
    targetRef.current = target;
    setReloadFrameSec(target);
  }, [setReloadFrameSec]);

  const restartStream = useCallback(async (opts?: RestartOptions): Promise<RestartOutcome> => {
    if (inFlightRef.current) return "busy";
    inFlightRef.current = true;
    const at = Math.max(0, opts?.at ?? positionRef.current);
    targetRef.current = at;
    plog("restart", `relance (${opts?.reason ?? "manual"}) à ${Math.round(at)}s`);
    softReloadRef.current = true;
    setReloadFrameSec(at);
    if (opts?.hold === false) setIsLoading(true);
    else holdForReload();
    resetLoadedRef.current();
    notifySeekRef.current(at, 8000, true);
    try {
      const outcome = await restartRef.current(() => targetRef.current, { keepSession: opts?.keepSession });
      plog("restart", `→ ${outcome}${targetRef.current !== at ? ` (cible déplacée à ${Math.round(targetRef.current)}s)` : ""}`);
      if (outcome !== "ok") {
        softReloadRef.current = false;
        setReloadFrameSec(null);
        setIsLoading(false);
        notifySeekRef.current(positionRef.current, 0);
      }
      return outcome;
    } finally {
      inFlightRef.current = false;
    }
  }, [positionRef, softReloadRef, setReloadFrameSec, holdForReload, setIsLoading, resetLoadedRef, notifySeekRef]);

  return { restartStream, noteSeek };
}
