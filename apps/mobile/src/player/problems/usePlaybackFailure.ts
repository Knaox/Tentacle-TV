import { useCallback, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import {
  describeProblem, diagnosePlaybackFailure, transcodeAllowedOf,
  type DiagnosedFailure, type PlaybackFailureContext, type ProblemAvailability, type ProblemModel, type Reachability,
} from "@tentacle-tv/shared";
import { runProbe } from "@/offline/connectivityProbe";
import { getConnectivitySnapshot } from "@/offline/connectivityStore";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { toPlaybackFailure, type PlaybackFailureReport } from "./playbackFailure";

export type { DiagnosedFailure, PlaybackFailureContext } from "@tentacle-tv/shared";

/** « Tentacle 1.10.3 · iOS 26.3 » — pour les détails transmis à l'administrateur. */
function appLabel(): string {
  const os = Platform.OS === "ios" ? (Platform.isPad ? "iPadOS" : "iOS") : Platform.OS === "android" ? "Android" : Platform.OS;
  return `Tentacle ${Constants.expoConfig?.version ?? "?"} · ${os} ${String(Platform.Version)}`;
}

/** La sonde de l'app, au moment de l'échec : qui ne répond pas. */
async function probeServers(serverUrl: string | null): Promise<Reachability | null> {
  if (!serverUrl) return null;
  const result = await runProbe(serverUrl);
  return result.ok ? "ok" : result.reason ?? "backend";
}

/**
 * L'échec d'une lecture, diagnostiqué : un signalement (moteur, requête,
 * constat), le contexte de la lecture, puis les sondes — celle des serveurs
 * et, si le moteur n'a rien dit de décisif, un octet du flux. Il n'en sort
 * qu'une cause, un contexte et des détails : le message se compose au rendu
 * (`usePlaybackProblemModel`), avec ce qui est possible À CET INSTANT.
 *
 * Les sondes ne partent qu'à l'échec, jamais en lecture normale. Un nouveau
 * signalement remplace le précédent ; `clear` les oublie tous.
 */
export function usePlaybackFailure(context: PlaybackFailureContext) {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const [diagnosed, setDiagnosed] = useState<DiagnosedFailure | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const seq = useRef(0);
  const contextRef = useRef(context);
  contextRef.current = context;

  const report = useCallback((failure: PlaybackFailureReport) => {
    const id = ++seq.current;
    setDiagnosing(true);
    void diagnosePlaybackFailure(toPlaybackFailure(failure), contextRef.current, {
      probeServers: () => probeServers(serverUrl),
      transcodeAllowed: transcodeAllowedOf(storage.getItem("tentacle_user")),
      deviceOffline: getConnectivitySnapshot().networkType === "none",
      app: appLabel(),
    }).then((next) => {
      if (seq.current !== id) return;
      setDiagnosed(next);
      setDiagnosing(false);
    });
  }, [serverUrl, storage]);

  const clear = useCallback(() => {
    seq.current += 1;
    setDiagnosed(null);
    setDiagnosing(false);
  }, []);

  return { diagnosed, diagnosing, report, clear };
}

/** Le message, composé avec ce qui est possible à cet instant (qualité, versions, sous-titres). */
export function usePlaybackProblemModel(
  diagnosed: DiagnosedFailure | null,
  availability: ProblemAvailability,
): ProblemModel | null {
  const key = JSON.stringify(availability);
  return useMemo(
    () => (diagnosed ? describeProblem({ ...diagnosed, availability }) : null),
    [diagnosed, key], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
