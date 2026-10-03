import {
  collectPlaybackFailure, mpvFailure, nativeVideoFailure,
  type CollectedFailure, type EngineFailure, type FailureMarker, type FailureTarget, type PlaybackFailure,
} from "@tentacle-tv/shared";

export { nextVersionId, transcodeAllowedOf, type CollectedFailure } from "@tentacle-tv/shared";

/**
 * Ce que le lecteur mobile sait d'un échec, dans la forme de la chaîne
 * commune (`problems/playbackDiagnosis.ts`, shared) : ses deux moteurs se
 * traduisent en `EngineFailure`, le reste passe tel quel. Module PUR — ni
 * React Native ni Expo —, testé sous vitest.
 */

export type PlaybackEngineKind = "mpv" | "native";

/** Un échec signalé au lecteur : le moteur, une requête, ou un constat de l'app. */
export type PlaybackFailureReport =
  | { from: "engine"; engine: PlaybackEngineKind; error: unknown }
  | { from: "request"; error: unknown; target: FailureTarget; request?: string }
  | { from: "marker"; marker: FailureMarker; jellyfinErrorCode?: string }
  /** Le fichier gardé sur l'appareil n'y est plus. */
  | { from: "missingFile" };

function messageOf(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return undefined;
}

function engineFailureOf(engine: PlaybackEngineKind, error: unknown): EngineFailure {
  if (engine === "mpv") return mpvFailure(messageOf(error) ?? "", "mpv");
  return nativeVideoFailure(error);
}

/** Le signalement du mobile, dans la forme commune. */
export function toPlaybackFailure(report: PlaybackFailureReport): PlaybackFailure {
  return report.from === "engine" ? { from: "engine", failure: engineFailureOf(report.engine, report.error) } : report;
}

/** L'échec brut d'un signalement, et ses faits. Le contexte de lecture s'ajoute ensuite. */
export function collectFailure(report: PlaybackFailureReport): CollectedFailure {
  return collectPlaybackFailure(toPlaybackFailure(report));
}
