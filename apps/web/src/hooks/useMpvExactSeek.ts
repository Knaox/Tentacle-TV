import { useCallback, useEffect, useRef } from "react";
import { getMpvApi, type MpvState } from "./mpvRuntime";
import type { MpvClockRefs } from "./mpvClock";
import { decideSeekLanding, initialSeekBackoffS, MPV_SEEK_LANDING_TIMEOUT_MS } from "./mpvSeekLanding";
import { traceCommand } from "./startupTrace";
import { wtLog } from "../watchTogether/wtLog";

/** Un atterrissage attendu : le seek (ou l'ouverture) qui l'a demandé. */
interface PendingLanding {
  targetS: number;
  at: number;
  /** `playback-restart` comptés au moment du seek — le suivant est le sien. */
  restartBase: number;
  relandings: number;
}

/**
 * Les seeks de mpv, rendus EXACTS sur un HLS Jellyfin — le branchement de
 * `mpvSeekLanding.ts` : chaque seek absolu (barre, ±30 s, arbitre de passages,
 * Watch Together) et chaque ouverture à une position sont suivis jusqu'à leur
 * `playback-restart`, où l'atterrissage est jugé. En retard, le recul du
 * démuxeur (`hr-seek-demuxer-offset`) s'élargit pour cette source et le seek
 * est refait une fois.
 *
 * Le recul lui-même est posé par `play()` AVANT le `loadfile` (option de
 * lecture), ce hook n'en tient que la valeur : douze secondes sur un HLS, zéro
 * en lecture directe, davantage dès qu'un atterrissage l'a exigé.
 */
export function useMpvExactSeek({
  src, isHls, state, clock, seek,
}: {
  src: string;
  /** Flux HLS (transcodage Jellyfin) : les seeks y atterrissent en retard. */
  isHls: boolean;
  state: MpvState;
  clock: MpvClockRefs;
  seek: (pos: number) => Promise<void>;
}): {
  /** Le seek à donner à tout le lecteur : même signature, atterrissage suivi. */
  seek: (pos: number) => Promise<void>;
  /** Recul en vigueur pour la source courante (à passer à `play()`). */
  backoffS: number;
  /** L'ouverture d'une source vise cette position (secondes de flux) — son
   *  premier `playback-restart` est jugé comme un seek. */
  noteLoadTarget: (streamPosS: number | undefined) => void;
} {
  // Le recul élargi ne vaut que pour la source qui l'a demandé : une source
  // neuve repart du recul initial.
  const raisedRef = useRef<{ src: string; value: number } | null>(null);
  const backoffS = raisedRef.current?.src === src ? raisedRef.current.value : initialSeekBackoffS(isHls);
  const pendingRef = useRef<PendingLanding | null>(null);
  const seekRef = useRef(seek);
  seekRef.current = seek;

  const arm = useCallback((targetS: number, relandings: number) => {
    pendingRef.current = { targetS, at: Date.now(), restartBase: clock.restartCountRef.current, relandings };
  }, [clock]);

  const exactSeek = useCallback(async (pos: number) => {
    arm(pos, 0);
    await seekRef.current(pos);
  }, [arm]);

  const noteLoadTarget = useCallback((streamPosS: number | undefined) => {
    if (streamPosS !== undefined && streamPosS > 0) arm(streamPosS, 0);
    else pendingRef.current = null;
  }, [arm]);

  // Le juge, à chaque battement de position ou de seek : un atterrissage
  // attendu se lit au premier `playback-restart` qui suit, seek terminé, sur
  // un `time-pos` mesuré APRÈS ce restart — pendant le seek, mpv annonce la
  // cible comme position, et un échantillon d'avant parlerait du départ.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    if (Date.now() - pending.at > MPV_SEEK_LANDING_TIMEOUT_MS) { pendingRef.current = null; return; }
    if (clock.restartCountRef.current === pending.restartBase || state.seeking) return;
    if (clock.positionAtRef.current < clock.restartAtRef.current) return;
    pendingRef.current = null;
    const landedS = clock.positionRef.current;
    const decision = decideSeekLanding({
      targetS: pending.targetS, landedS, backoffS, isHls, relandings: pending.relandings,
    });
    if (decision.kind === "landed") {
      wtLog("mpv-seek", "atterrissage posé", { targetS: pending.targetS.toFixed(2), landedS: landedS.toFixed(2), backoffS });
      return;
    }
    wtLog("mpv-seek", `atterrissage en retard de ${decision.lateS.toFixed(2)} s — recul du démuxeur porté à ${decision.backoffS} s`, {
      targetS: pending.targetS.toFixed(2), landedS: landedS.toFixed(2), reseek: decision.reseek,
    });
    traceCommand("recul du démuxeur élargi", `${decision.backoffS} s (retard ${decision.lateS.toFixed(1)} s)`);
    raisedRef.current = { src, value: decision.backoffS };
    getMpvApi()?.command("set", ["hr-seek-demuxer-offset", String(decision.backoffS)])
      .catch((e) => console.warn("[mpv] set hr-seek-demuxer-offset:", e));
    if (decision.reseek) {
      arm(pending.targetS, pending.relandings + 1);
      void seekRef.current(pending.targetS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.position, state.seeking]);

  return { seek: exactSeek, backoffS, noteLoadTarget };
}
