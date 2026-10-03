import { classifyProblem, type FailureMarker, type FailureTarget, type RawProblem, type Reachability } from "./classifyProblem";
import { probeStream, shouldProbeSource, shouldProbeStream, withProbes } from "./diagnose";
import type { EngineFailure } from "./engineErrors";
import { rawFromError } from "./fromError";
import { problemDetails, type ProblemFacts } from "./problemDetails";
import type { ProblemCause, ProblemContext, ProblemDetail } from "./problemTypes";

/**
 * L'échec d'une lecture, de son signalement à sa cause — la même chaîne pour
 * le mobile (mpv, lecteur système), le web (hls.js, `<video>`) et le bureau
 * (mpv) : chaque lecteur ne fait que traduire son moteur en `EngineFailure`
 * et fournir sa sonde des serveurs.
 */

/** Un échec signalé au lecteur : le moteur, une requête, ou un constat de l'app. */
export type PlaybackFailure =
  | { from: "engine"; failure: EngineFailure }
  | { from: "request"; error: unknown; target: FailureTarget; request?: string }
  | { from: "marker"; marker: FailureMarker; jellyfinErrorCode?: string }
  /** Le fichier gardé sur l'appareil n'y est plus. */
  | { from: "missingFile" };

export interface CollectedFailure {
  raw: RawProblem;
  facts: ProblemFacts;
}

/** L'échec brut d'un signalement, et ses faits. Le contexte de lecture s'ajoute ensuite. */
export function collectPlaybackFailure(report: PlaybackFailure): CollectedFailure {
  switch (report.from) {
    case "engine": {
      const { failure } = report;
      return {
        raw: { status: failure.status, kind: failure.kind, message: failure.message, target: "stream" },
        facts: { status: failure.status, engine: failure.engine, code: failure.code, message: failure.message },
      };
    }
    case "request": {
      const raw = rawFromError(report.error, report.target);
      return { raw, facts: { status: raw.status, request: report.request, message: raw.message } };
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

/**
 * « Qualité réduite » : le palier suivant qui impose un débit — depuis la
 * lecture directe, c'est la conversion ; `null` s'il n'y en a plus.
 */
export function lowerQualityTier<K extends string>(
  presets: readonly { key: K; bitrate: number | null }[],
  currentKey: K,
): K | null {
  const index = presets.findIndex((preset) => preset.key === currentKey);
  return presets.slice(index + 1).find((preset) => preset.bitrate != null)?.key ?? null;
}

/** Ce que le lecteur sait de sa lecture au moment de l'échec. */
export interface PlaybackFailureContext {
  streamUrl: string | null;
  headers: Record<string, string>;
  /** La première image est passée : « La lecture s'est arrêtée ». */
  started: boolean;
  transcoding: boolean;
  burningSubtitles: boolean;
  /** Un fichier gardé sur l'appareil : rien à sonder sur le réseau. */
  local?: boolean;
  /** Le fichier source (flux statique) : seul lui dit qu'il manque sur le disque du serveur. */
  sourceUrl?: string | null;
}

/** Ce que l'appareil apporte : sa sonde, ce qu'il sait du compte et du réseau, son nom. */
export interface PlaybackDiagnosisEnv {
  /** Qui ne répond pas, au moment de l'échec ; `null` faute de sonde. */
  probeServers: () => Promise<Reachability | null>;
  transcodeAllowed?: boolean;
  deviceOffline?: boolean;
  /** « Tentacle 1.10.3 · iOS 26.3 » — pour les détails transmis à l'administrateur. */
  app?: string;
}

export interface DiagnosedFailure {
  cause: ProblemCause;
  context: ProblemContext;
  details: ProblemDetail[];
}

/**
 * Un signalement, diagnostiqué : le contexte de la lecture, puis les sondes —
 * celle des serveurs et, si le moteur n'a rien dit de décisif, un octet du
 * flux et du fichier source. Il n'en sort qu'une cause, un contexte et des
 * détails ; le message se compose au rendu, avec ce qui est possible À CET
 * INSTANT. Les sondes ne partent qu'à l'échec, jamais en lecture normale.
 */
export async function diagnosePlaybackFailure(
  report: PlaybackFailure,
  ctx: PlaybackFailureContext,
  env: PlaybackDiagnosisEnv,
): Promise<DiagnosedFailure> {
  const { raw, facts } = collectPlaybackFailure(report);
  const full: RawProblem = {
    ...raw,
    started: ctx.started,
    transcoding: ctx.transcoding,
    burningSubtitles: ctx.burningSubtitles,
    local: ctx.local,
    transcodeAllowed: env.transcodeAllowed,
    deviceOffline: env.deviceOffline,
  };
  const [reachability, streamProbe, sourceProbe] = await Promise.all([
    ctx.local ? null : env.probeServers(),
    !ctx.local && ctx.streamUrl && shouldProbeStream(full) ? probeStream(ctx.streamUrl, ctx.headers) : null,
    // Une requête en échec (la fiche, la négociation) dit déjà sa cause par son
    // statut : la fiche introuvable n'est pas un fichier manquant.
    report.from !== "request" && ctx.sourceUrl && shouldProbeSource(full) ? probeStream(ctx.sourceUrl, ctx.headers) : null,
  ]);
  const probed = withProbes(full, reachability, streamProbe, sourceProbe);
  return {
    cause: classifyProblem(probed),
    context: ctx.local ? "offlinePlayback" : ctx.started ? "playbackStopped" : "playbackStart",
    details: problemDetails({
      ...facts,
      status: probed.status ?? facts.status,
      sourceStatus: sourceProbe?.status,
      stream: ctx.local ? "local" : !ctx.streamUrl ? undefined : ctx.transcoding ? "transcode" : "direct",
      app: env.app,
    }),
  };
}
