import { useEffect, useRef, type MutableRefObject } from "react";
import { useJellyfinOutage } from "@tentacle-tv/api-client";
import { restartOnJellyfinReturn, serverOutageProbe } from "@tentacle-tv/tv-core";
import type { RecoveryState } from "./recoveryState";
import type { RecoverySources } from "./recoverySources";
import type { RestartReason } from "./streamRestart";
import { plog } from "../utils/playerDiag";

/**
 * L'état de Jellyfin dit par le serveur (`server:jellyfin`), appliqué à la
 * reprise de la lecture (`usePlaybackRecovery`) — la décision est dans
 * tv-core (`serverOutage.ts`) : en panne, une sonde qui fait foi ; au retour,
 * une relance du flux à la position, mêmes pistes, nouvelle session.
 */
export function useServerJellyfinHealth(
  state: MutableRefObject<RecoveryState>,
  src: MutableRefObject<RecoverySources | undefined>,
  tick: MutableRefObject<() => void>,
  restart: (reason?: RestartReason) => Promise<void>,
): void {
  const outage = useJellyfinOutage();
  const down = outage.phase === "outage" || outage.phase === "long";

  useEffect(() => {
    if (!down) return;
    const st = state.current;
    Object.assign(st, serverOutageProbe(Date.now(), st));
    plog("recover", `Jellyfin ${outage.state}, dit par le serveur → chemin du flux à terre`);
    tick.current();
  }, [down, outage.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const seen = useRef(outage.recoveries);
  useEffect(() => {
    if (outage.recoveries === seen.current) return;
    seen.current = outage.recoveries;
    const st = state.current;
    const s = src.current;
    // Le chemin répond : la décision le sait sans attendre sa sonde.
    Object.assign(st, { source: "ok", culprit: null, checkedAt: Date.now() });
    const go = restartOnJellyfinReturn({
      now: Date.now(), started: !!s?.s.hasStarted, ended: !!s?.s.endedRef.current, restarting: st.restarting, lastRestartAt: st.lastRestartAt,
    });
    plog("recover", `Jellyfin de retour, dit par le serveur → ${go ? "relance du flux" : "relance déjà faite"}`);
    if (go) void restart("network");
    else tick.current();
  }, [outage.recoveries]); // eslint-disable-line react-hooks/exhaustive-deps
}
