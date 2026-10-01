import { useCallback, useEffect, useRef } from "react";
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
 * l'indicateur tourne, et la reprise n'y voit pas un arrêt de débit.
 *
 * Rend `false` quand le budget de l'incident est épuisé : au gestionnaire de
 * le dire. Une erreur répétée pendant qu'une tentative attend ne compte pas
 * double (AVPlayer signale parfois deux fois la même chute).
 */
export function useAudioErrorRetry(sources: RecoverySources | undefined): (error: string) => boolean {
  const src = useRef(sources);
  src.current = sources;
  const attemptRef = useRef(0);
  const incidentAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return useCallback((error: string): boolean => {
    const s = src.current;
    if (!s) return false;
    if (timerRef.current) return true;
    const pos = s.s.positionRef.current;
    // La lecture avait repris depuis l'incident précédent : nouvel incident.
    if (incidentAtRef.current !== null && s.s.hasStarted && pos >= incidentAtRef.current + PROGRESS_S) attemptRef.current = 0;
    const delay = audioRetryDelay(attemptRef.current);
    if (delay === null) {
      attemptRef.current = 0;
      incidentAtRef.current = null;
      return false;
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
    return true;
  }, []);
}
