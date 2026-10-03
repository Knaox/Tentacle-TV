import {
  mpvFailure, nativeVideoFailure,
  type EngineFailure, type FailureMarker, type FailureTarget, type ProblemFacts, type RawProblem,
} from "@tentacle-tv/shared";

/**
 * Ce que le lecteur mobile sait d'un échec, mis dans la forme du modèle
 * commun : l'échec brut (`RawProblem`, que le classifieur tranche) et les
 * faits techniques (« Détails »). Module PUR — ni React Native ni Expo —,
 * testé sous vitest.
 */

export type PlaybackEngineKind = "mpv" | "native";

/** Un échec signalé au lecteur : le moteur, une requête, ou un constat de l'app. */
export type PlaybackFailureReport =
  | { from: "engine"; engine: PlaybackEngineKind; error: unknown }
  | { from: "request"; error: unknown; target: FailureTarget; request?: string }
  | { from: "marker"; marker: FailureMarker; jellyfinErrorCode?: string }
  /** Le fichier gardé sur l'appareil n'y est plus. */
  | { from: "missingFile" };

export interface CollectedFailure {
  raw: RawProblem;
  facts: ProblemFacts;
}

function messageOf(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return undefined;
}

/** Le statut d'une réponse en échec (JellyfinError, TentacleApiError) — `undefined` sur une panne de transport. */
export function statusOf(error: unknown): number | undefined {
  const status = typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined;
  return typeof status === "number" && status > 0 ? status : undefined;
}

function engineFailureOf(engine: PlaybackEngineKind, error: unknown): EngineFailure {
  if (engine === "mpv") return mpvFailure(messageOf(error) ?? "", "mpv");
  return nativeVideoFailure(error);
}

/** L'échec brut d'un signalement, et ses faits. Le contexte de lecture s'ajoute ensuite. */
export function collectFailure(report: PlaybackFailureReport): CollectedFailure {
  switch (report.from) {
    case "engine": {
      const failure = engineFailureOf(report.engine, report.error);
      return {
        raw: { status: failure.status, kind: failure.kind, message: failure.message, target: "stream" },
        facts: { status: failure.status, engine: failure.engine, code: failure.code, message: failure.message },
      };
    }
    case "request": {
      const status = statusOf(report.error);
      const message = messageOf(report.error);
      const name = report.error instanceof Error ? report.error.name : undefined;
      return {
        raw: { status, message, name, target: report.target },
        facts: { status, request: report.request, message },
      };
    }
    case "marker":
      return {
        raw: { marker: report.jellyfinErrorCode ? undefined : report.marker, jellyfinErrorCode: report.jellyfinErrorCode },
        facts: { jellyfinErrorCode: report.jellyfinErrorCode },
      };
    case "missingFile":
      return { raw: { kind: "notFound", target: "stream" }, facts: {} };
  }
}

/** Le compte peut-il faire convertir ? `undefined` si le profil gardé ne le dit pas. */
export function transcodeAllowedOf(storedUser: string | null): boolean | undefined {
  if (!storedUser) return undefined;
  try {
    const value = JSON.parse(storedUser)?.Policy?.EnableVideoPlaybackTranscoding;
    return typeof value === "boolean" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** La version suivante du titre, pour « Autre version » — `null` s'il n'y en a qu'une. */
export function nextVersionId(sources: readonly { Id?: string }[] | undefined, currentId: string | undefined): string | null {
  const ids = (sources ?? []).map((source) => source.Id).filter((id): id is string => !!id);
  if (ids.length < 2) return null;
  const index = currentId ? ids.indexOf(currentId) : -1;
  return ids[(index + 1) % ids.length] ?? null;
}
