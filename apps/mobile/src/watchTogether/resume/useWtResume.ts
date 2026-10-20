import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { reconnectSocketNow, sampleClock, sendSocketMessage } from "@tentacle-tv/api-client";
import { WT_CLOCK_BURST_COUNT, WT_CLOCK_BURST_SPACING_MS } from "@tentacle-tv/shared";
import { useConnectivity } from "@/offline/useConnectivity";
import { networkResumeActions, resumeActions, type AppPhase, type ResumeAction } from "./resumeRule";

function run(actions: readonly ResumeAction[]): void {
  if (actions.includes("reconnect")) reconnectSocketNow();
  if (actions.includes("syncRequest")) sendSocketMessage({ type: "wt:syncRequest" });
  if (actions.includes("clockBurst")) {
    for (let i = 0; i < WT_CLOCK_BURST_COUNT; i++) setTimeout(sampleClock, i * WT_CLOCK_BURST_SPACING_MS);
  }
}

/** La reprise du Watch Together après l'arrière-plan ou une coupure (voir `resumeRule`). */
export function useWtResume(inGroup: boolean): void {
  const inGroupRef = useRef(inGroup);
  inGroupRef.current = inGroup;

  useEffect(() => {
    let phase: AppPhase = AppState.currentState as AppPhase;
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      run(resumeActions(phase, next as AppPhase, inGroupRef.current));
      phase = next as AppPhase;
    });
    return () => sub.remove();
  }, []);

  const { state } = useConnectivity();
  const online = state === "online";
  const wasOnline = useRef(online);
  useEffect(() => {
    run(networkResumeActions(wasOnline.current, online, inGroupRef.current));
    wasOnline.current = online;
  }, [online]);
}
