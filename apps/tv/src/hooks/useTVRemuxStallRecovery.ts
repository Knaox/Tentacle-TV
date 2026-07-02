import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { NativeModules } from "react-native";
import { TICKS_PER_SECOND } from "@tentacle-tv/shared";

const Remux = (NativeModules as { TVLocalRemux?: { prepareResume?: () => void } }).TVLocalRemux;

/**
 * Récupération d'un stall du remux local tvOS (`-11866` : manifeste HLS `event`
 * figé malgré le keepalive de pause, ou session locale morte en lecture).
 *
 * - Stall pendant une PAUSE → récupération DIFFÉRÉE (« lazy ») : la session est
 *   marquée morte (`deadSessionRef`), l'image figée est posée à la position de
 *   pause et on RESTE en pause — aucun reload tant que l'utilisateur ne reprend
 *   pas. À la reprise, useTVRemuxPause voit le flag et remonte une session
 *   fraîche à la position exacte (chemin mode B, prébuffer réduit côté natif).
 *   → une pause longue ne peut plus faire « rejouer » la vidéo.
 * - Stall pendant la LECTURE → reload immédiat À LA POSITION COURANTE (miroir
 *   du chemin re-remux hors-fenêtre de useTVRemuxSeek) — plus jamais de
 *   redémarrage à `startSeconds` (souvent 0) ni de dé-pause forcée.
 *
 * Les stalls réémis pendant qu'un reload est en vol (session sortante) ou
 * pendant une pause déjà morte sont absorbés sans effet.
 */
export function useTVRemuxStallRecovery(args: {
  pausedStateRef: MutableRefObject<boolean>;
  positionRef: MutableRefObject<number>;
  softReloadRef: MutableRefObject<boolean>;
  /** Miroir de `reloadHold` (PlayerScreen) : un reload de reprise/seek est en vol. */
  reloadHoldRef: MutableRefObject<boolean>;
  /** Session HLS locale morte pendant une pause — possédé par PlayerScreen,
   *  consommé aussi par useTVRemuxPause (reprise) et useTVRemuxSeek. */
  deadSessionRef: MutableRefObject<boolean>;
  setReloadFrameSec: (s: number | null) => void;
  setReloadNonce: Dispatch<SetStateAction<number>>;
  setStartTicks: Dispatch<SetStateAction<number>>;
  holdForReload: () => void;
  notifySeekRef: MutableRefObject<(target: number, windowMs?: number, afterReload?: boolean) => void>;
  resetLoadedRef: MutableRefObject<() => void>;
}) {
  const {
    pausedStateRef, positionRef, softReloadRef, reloadHoldRef, deadSessionRef,
    setReloadFrameSec, setReloadNonce, setStartTicks, holdForReload, notifySeekRef, resetLoadedRef,
  } = args;

  const onRemuxStall = useCallback(() => {
    // Reload déjà en vol (reprise/seek/récupération) → l'erreur vient de la
    // session sortante : ignorer.
    if (softReloadRef.current || reloadHoldRef.current) return;
    const p = positionRef.current;
    if (pausedStateRef.current) {
      // PAUSE → lazy : marquer la session morte, figer l'image à P, rester en
      // pause. Les stalls suivants sont absorbés (flag déjà posé).
      if (!deadSessionRef.current) {
        deadSessionRef.current = true;
        setReloadFrameSec(p);
      }
      return;
    }
    // Micro-fenêtre : dé-pause demandée mais effet de reprise pas encore passé —
    // la reprise (useTVRemuxPause) pilote le re-remux, ne pas doubler.
    if (deadSessionRef.current) return;
    // LECTURE → reload immédiat à la position courante (jamais startSeconds).
    Remux?.prepareResume?.(); // session fraîche garantie (manifeste frais, anti re-stall)
    softReloadRef.current = true;
    holdForReload();
    resetLoadedRef.current();
    setReloadFrameSec(p);
    notifySeekRef.current(p, 8000, true);
    setStartTicks(Math.floor(p * TICKS_PER_SECOND));
    // Bust garanti de la clé remux même si p retombe sur l'ancien startTicks.
    setReloadNonce((n) => n + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { onRemuxStall };
}
