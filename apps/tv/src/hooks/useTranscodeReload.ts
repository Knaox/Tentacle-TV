import { useCallback, useMemo, useRef } from "react";
import { isSegmentTimeout } from "@tentacle-tv/tv-core";
import type { RecoverySources } from "./recoverySources";
import type { RecoveryState } from "./recoveryState";
import { plog } from "../utils/playerDiag";

export interface TranscodeReload {
  /** Consulté en premier par le gestionnaire d'erreurs : `true` = pris en charge. */
  onSlowSegment: (error: string) => boolean;
  /** Recharge la MÊME session (décision de la règle : rien depuis 30 s). */
  reload: (why: string) => void;
}

/**
 * La MÊME session d'un transcodage, rechargée — à l'ouverture comme en
 * lecture. Deux causes, mesurées au simulateur (transcodage simulé à ×0,3) :
 * - un segment qui tarde (`isSegmentTimeout`, tv-core) : AVPlayer abandonne
 *   l'élément en -12889 au bout de ~40 s sans premier segment ;
 * - AVPlayer qui n'attend plus rien : après un rechargement, il abandonne un
 *   segment lent au bout de ~6 s et ne le redemande PLUS, sans erreur — la
 *   règle le voit (aucune donnée depuis 30 s) et demande `reload`.
 * Le serveur, lui, travaille encore : une session NEUVE tuait son travail et
 * repartait de zéro (la vidéo ne venait jamais) ; un élément neuf sur la même
 * session (`restartStream({ keepSession })`) trouve ce qui est déjà produit.
 * Sans pause de rechargement (`hold: false`) : l'élément en échec ne joue
 * plus rien, et un AVPlayer en pause cesse de remplir sa mémoire (mesuré :
 * deux segments, puis plus aucune requête).
 */
export function useTranscodeReload(
  src: { readonly current: RecoverySources | undefined },
  state: { readonly current: RecoveryState },
): TranscodeReload {
  const inFlight = useRef(false);

  const reload = useCallback((why: string) => {
    const s = src.current;
    if (!s || inFlight.current || s.p.isDirectPlay || s.p.isPrismCore || s.s.endedRef.current) return;
    const st = state.current;
    const at = s.s.positionRef.current;
    if (s.s.hasStarted) {
      // L'incident reste ouvert pendant le rechargement : c'est la même attente.
      st.openSince ??= st.stalledSince ?? Date.now();
      st.incidentPos ??= at;
    }
    st.lastReloadAt = Date.now();
    inFlight.current = true;
    plog("recover", `transcodage : ${why} → même session rechargée à ${Math.round(at)} s`);
    void s.p.restartStream({ at, reason: "transcode", keepSession: true, hold: false })
      .finally(() => { inFlight.current = false; });
  }, [src, state]);

  const onSlowSegment = useCallback((error: string) => {
    const s = src.current;
    if (!s || s.p.isDirectPlay || s.p.isPrismCore || s.s.endedRef.current || !isSegmentTimeout(error)) return false;
    reload(`segment abandonné par AVPlayer (${error.slice(0, 60)})`);
    return true;
  }, [src, reload]);

  return useMemo(() => ({ onSlowSegment, reload }), [onSlowSegment, reload]);
}
