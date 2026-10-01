import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { audioRetryDelay } from "@tentacle-tv/tv-core";
import type { RecoverySources } from "./usePlaybackRecovery";
import { plog } from "../utils/playerDiag";

/** La lecture a repris : elle avance de tant depuis l'incident. */
const PROGRESS_S = 2;

/**
 * Une erreur AUDIO PASSAGÈRE (la sortie reconfigurée sous la lecture — règle
 * pure : `classifyAvPlayerError`, tv-core) se rejoue à la MÊME forme, après
 * un délai : la relance du flux (`restartStream`), en rechargement doux, à la
 * position courante — ou à la reprise prévue si la première image n'est pas
 * encore là. Jamais la forme muxée, jamais le transcodage.
 *
 * Pendant l'attente, le lecteur est tenu en rechargement (`holdForReload`) :
 * l'indicateur tourne, et la reprise n'y voit pas un arrêt de débit. Une
 * erreur répétée pendant qu'une tentative attend ne compte pas double
 * (AVPlayer signale parfois deux fois la même chute).
 *
 * Le budget épuisé, le bandeau le dit — et le geste qu'il propose est le bon :
 * l'appui sur Lecture (une bascule de `paused`, d'où qu'elle vienne :
 * télécommande ou habillage) relance le flux à la position, budget neuf.
 */
export function useAudioErrorRetry(
  sources: RecoverySources | undefined,
  say: { setVideoError: (error: string | null) => void; setIsLoading?: (loading: boolean) => void; lostMessage: string },
): (error: string) => void {
  const src = useRef(sources);
  src.current = sources;
  const sayRef = useRef(say);
  sayRef.current = say;
  const attemptRef = useRef(0);
  const incidentAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Le bandeau dit la sortie perdue : le prochain Lecture relance. */
  const lostRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const paused = sources?.s.paused;
  const pausedBeforeRef = useRef(paused);
  useEffect(() => {
    const before = pausedBeforeRef.current;
    pausedBeforeRef.current = paused;
    const s = src.current;
    // Une mise en pause de l'app (arrière-plan) n'est pas un appui.
    if (!lostRef.current || !s || before === undefined || before === paused || AppState.currentState !== "active") return;
    lostRef.current = false;
    attemptRef.current = 0;
    incidentAtRef.current = null;
    sayRef.current.setVideoError(null);
    if (paused) s.s.setPaused(false);
    plog("err", "Lecture après la sortie audio perdue → relance du flux");
    void s.p.restartStream({ at: s.s.positionRef.current, reason: "manual" });
  }, [paused]);

  return useCallback((error: string): void => {
    const s = src.current;
    if (!s || timerRef.current) return;
    const pos = s.s.positionRef.current;
    // La lecture avait repris depuis l'incident précédent : nouvel incident.
    if (incidentAtRef.current !== null && s.s.hasStarted && pos >= incidentAtRef.current + PROGRESS_S) attemptRef.current = 0;
    const delay = audioRetryDelay(attemptRef.current);
    if (delay === null) {
      // La sortie ne revient pas : le dire — une autre forme ne la rendrait pas.
      plog("err", `sortie audio toujours indisponible → erreur dite (${error.slice(0, 60)})`);
      attemptRef.current = 0;
      incidentAtRef.current = null;
      lostRef.current = true;
      sayRef.current.setIsLoading?.(false);
      sayRef.current.setVideoError(sayRef.current.lostMessage);
      return;
    }
    attemptRef.current += 1;
    const at = s.s.hasStarted ? pos : s.p.startSeconds;
    incidentAtRef.current = at;
    plog("err", `sortie audio indisponible (${error.slice(0, 60)}) → même forme dans ${delay} ms, à ${Math.round(at)} s`);
    s.s.holdForReload();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void src.current?.p.restartStream({ at, reason: "audio" });
    }, delay);
  }, []);
}
