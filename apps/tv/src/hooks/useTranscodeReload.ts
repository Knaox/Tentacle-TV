import { useCallback, useRef } from "react";
import { isSegmentTimeout } from "@tentacle-tv/tv-core";
import type { RecoverySources } from "./recoverySources";
import type { RecoveryState } from "./recoveryState";
import { plog } from "../utils/playerDiag";

/**
 * Un segment qui tarde sur un TRANSCODAGE (`isSegmentTimeout`, tv-core) :
 * AVPlayer a abandonné l'élément, le serveur, lui, travaille encore. On
 * recharge la MÊME session (`restartStream({ keepSession })`) — à
 * l'ouverture comme en lecture —, et l'attente continue sans panneau : la
 * règle reste celle d'un transcodage qui se fait attendre (deux minutes sans
 * aucune progression, la main à l'utilisateur). Une relance neuve tuait le
 * travail fait, et la session suivante échouait au même endroit : la vidéo
 * ne venait jamais.
 *
 * Rend le gestionnaire que `useTVErrorHandler` consulte avant la reprise
 * d'une source perdue : `true` = pris en charge.
 */
export function useTranscodeReload(
  src: { readonly current: RecoverySources | undefined },
  state: { readonly current: RecoveryState },
): (error: string) => boolean {
  const inFlight = useRef(false);
  return useCallback((error: string) => {
    const s = src.current;
    if (!s || s.p.isDirectPlay || s.p.isPrismCore || s.s.endedRef.current || !isSegmentTimeout(error)) return false;
    const st = state.current;
    const at = s.s.positionRef.current;
    if (s.s.hasStarted) {
      // L'incident reste ouvert pendant le rechargement : c'est la même attente.
      st.openSince ??= st.stalledSince ?? Date.now();
      st.incidentPos ??= at;
    }
    if (inFlight.current) return true;
    inFlight.current = true;
    plog("recover", `segment abandonné par AVPlayer sur un transcodage (${error.slice(0, 60)}) → même session rechargée à ${Math.round(at)} s`);
    void s.p.restartStream({ at, reason: "transcode", keepSession: true }).finally(() => { inFlight.current = false; });
    return true;
  }, [src, state]);
}
