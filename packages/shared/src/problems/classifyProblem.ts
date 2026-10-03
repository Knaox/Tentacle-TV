import type { ProblemCause } from "./problemTypes";

/**
 * D'un échec brut — une réponse HTTP, une exception réseau, l'erreur d'un
 * moteur de lecture — à UNE cause en mots de spectateur. Pur : chaque
 * plateforme rassemble ce qu'elle sait (`RawProblem`), les adaptateurs des
 * moteurs (`engineErrors.ts`) traduisent leurs codes en `kind`, et la règle
 * tranche ici, dans un ordre fixe.
 */

/** Ce qu'un adaptateur sait dire de l'échec, sans HTTP. */
export type FailureKind =
  | "network"
  | "timeout"
  | "tls"
  | "cleartext"
  | "decode"
  | "notFound"
  | "engine"
  | "aborted";

/** Ce que l'app pose elle-même sur un échec qu'elle a constaté. */
export type FailureMarker =
  | "startTimeout"
  | "engineFailed"
  | "subtitleBurn"
  | "bandwidth"
  | "noMediaSource";

/** Ce qu'on joignait : le sens d'un 404 ou d'un 502 en dépend. */
export type FailureTarget =
  /** Une route du serveur Tentacle (`/api/…`). */
  | "tentacle"
  /** `/api/health` : l'adresse saisie est-elle un serveur Tentacle ? */
  | "health"
  /** Jellyfin, en direct ou par le relais du serveur (fiche, PlaybackInfo). */
  | "jellyfin"
  /** Le flux vidéo lui-même. */
  | "stream"
  /** La page d'une extension. */
  | "extension";

export interface RawProblem {
  status?: number;
  message?: string;
  /** `TypeError`, `AbortError`, `TimeoutError`… */
  name?: string;
  kind?: FailureKind;
  marker?: FailureMarker;
  target?: FailureTarget;
  /** `ErrorCode` de PlaybackInfo (« NoCompatibleStream », « NotAllowed », « RateLimitExceeded »). */
  jellyfinErrorCode?: string;
  /** L'appareil se sait sans réseau (NetInfo, `navigator.onLine`). */
  deviceOffline?: boolean;
  /** La lecture avait affiché sa première image. */
  started?: boolean;
  /** Le flux était converti par le serveur. */
  transcoding?: boolean;
  /** Des sous-titres étaient incrustés par le serveur. */
  burningSubtitles?: boolean;
  /** Lecture d'un fichier gardé sur l'appareil. */
  local?: boolean;
  /** Le compte peut-il faire convertir (`Policy.EnableVideoPlaybackTranscoding`) ? */
  transcodeAllowed?: boolean;
}

const NETWORK_TEXT = /network request failed|failed to fetch|networkerror|load failed|network connection was lost|econnrefused|econnreset|enotfound|ehostunreach|enetunreach|getaddrinfo|could not connect|connection refused|no route to host|socket hang up|internet connection appears to be offline|unable to resolve host|failed to connect/i;
const TIMEOUT_TEXT = /timed? ?out|timeout|délai/i;
const TLS_TEXT = /certificate|ssl|tls|handshake|cert_|certpath|trust anchor/i;
const CLEARTEXT_TEXT = /cleartext|app transport security/i;
const NOT_FOUND_TEXT = /no such file|enoent|file not found|filenotfound|does not exist/i;

/** Le `kind` d'un message ou d'un nom d'erreur, à défaut de code. */
export function kindFromText(text: string | undefined, name?: string): FailureKind | undefined {
  if (name === "AbortError" || name === "TimeoutError") return "timeout";
  if (!text) return undefined;
  if (CLEARTEXT_TEXT.test(text)) return "cleartext";
  if (TLS_TEXT.test(text)) return "tls";
  if (NOT_FOUND_TEXT.test(text)) return "notFound";
  if (TIMEOUT_TEXT.test(text)) return "timeout";
  if (NETWORK_TEXT.test(text)) return "network";
  return undefined;
}

function fromMarker(raw: RawProblem): ProblemCause | null {
  switch (raw.marker) {
    case "startTimeout": return raw.deviceOffline ? "deviceOffline" : "startTimeout";
    case "engineFailed": return "engineFailed";
    case "subtitleBurn": return "subtitleBurnFailed";
    case "bandwidth": return "bandwidthTooLow";
    case "noMediaSource": return "fileMissing";
    default: return null;
  }
}

function fromJellyfinCode(raw: RawProblem): ProblemCause | null {
  switch (raw.jellyfinErrorCode) {
    case "NotAllowed": return "notAllowed";
    case "NoCompatibleStream": return raw.transcodeAllowed === false ? "transcodeNotAllowed" : "noCompatibleStream";
    case "RateLimitExceeded": return "tooManyStreams";
    default: return null;
  }
}

/** Un échec du serveur qui convertit : les sous-titres incrustés d'abord, s'il y en avait. */
const conversionFailed = (raw: RawProblem): ProblemCause => (raw.burningSubtitles ? "subtitleBurnFailed" : "transcodeFailed");

function fromStatus(raw: RawProblem, status: number): ProblemCause | null {
  const target = raw.target ?? "tentacle";
  if (status === 401) return "sessionExpired";
  if (status === 403) return "notAllowed";
  if (status === 404) {
    if (target === "health") return "notTentacle";
    if (target === "extension") return "extensionMissing";
    if (target === "stream") return raw.transcoding ? conversionFailed(raw) : "fileMissing";
    if (target === "jellyfin") return "itemNotFound";
    return "serverTooOld";
  }
  if (status === 408) return "serverTimeout";
  if (status === 429) return target === "stream" || target === "jellyfin" ? "tooManyStreams" : "serverError";
  if (status === 502 || status === 503 || status === 504) {
    // Le relais du serveur ne joint plus Jellyfin ; devant le serveur lui-même,
    // c'est son mandataire inverse qui ne le joint plus.
    if (target === "tentacle" || target === "health") return "serverUnreachable";
    return "jellyfinUnreachable";
  }
  if (status >= 500) {
    if (target === "stream") return raw.transcoding ? conversionFailed(raw) : "jellyfinError";
    if (target === "jellyfin") return "jellyfinError";
    return "serverError";
  }
  return null;
}

function fromKind(raw: RawProblem, kind: FailureKind): ProblemCause | null {
  switch (kind) {
    case "tls": return "certificate";
    case "cleartext": return "insecureBlocked";
    case "timeout": return raw.started ? "connectionLost" : "serverTimeout";
    case "network":
      if (raw.started) return "connectionLost";
      // Jellyfin joint en direct (fiche, lecture directe) ; sinon, le serveur
      // Tentacle — ou son relais, par où passe le flux.
      return raw.target === "jellyfin" ? "jellyfinUnreachable" : "serverUnreachable";
    case "decode":
      if (raw.transcodeAllowed === false && !raw.transcoding) return "transcodeNotAllowed";
      return "decodeFailed";
    case "notFound":
      if (raw.target === "stream") return "fileMissing";
      if (raw.target === "extension") return "extensionMissing";
      return "itemNotFound";
    case "engine": return "engineFailed";
    case "aborted": return null;
  }
}

/**
 * La cause d'un échec. L'ordre compte : le fichier local d'abord (rien du
 * réseau ne le concerne), puis ce que l'app a constaté elle-même, l'appareil
 * hors ligne, le verdict de Jellyfin, le statut HTTP, et enfin la nature de
 * l'échec, déduite au besoin du message.
 */
export function classifyProblem(raw: RawProblem): ProblemCause {
  const kind = raw.kind ?? kindFromText(raw.message, raw.name);
  if (raw.local) return kind === "notFound" ? "offlineFileMissing" : "offlineFileDamaged";
  const marked = fromMarker(raw);
  if (marked) return marked;
  if (raw.deviceOffline) return "deviceOffline";
  const jellyfin = fromJellyfinCode(raw);
  if (jellyfin) return jellyfin;
  if (raw.status !== undefined && raw.status > 0) {
    const byStatus = fromStatus(raw, raw.status);
    if (byStatus) return byStatus;
  }
  if (kind) return fromKind(raw, kind) ?? "unknown";
  return "unknown";
}
