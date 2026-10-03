import { kindFromText, type FailureKind } from "./classifyProblem";

/**
 * Les erreurs des moteurs de lecture, lues dans leur propre vocabulaire et
 * rendues dans celui du modèle : un statut HTTP s'il se devine, une nature
 * d'échec (`FailureKind`), et ce qui ira dans « Détails » (moteur, code).
 * Pur : la plateforme passe l'objet que son moteur lui a donné.
 */
export interface EngineFailure {
  status?: number;
  kind?: FailureKind;
  /** Le nom du moteur, pour « Détails ». */
  engine: string;
  /** Le code natif, tel quel. */
  code?: string;
  /** Le message brut. */
  message?: string;
}

const HTTP_IN_TEXT = /\bHTTP(?:\s+error)?[\s:]*([1-5]\d\d)\b|\bResponse code:\s*([1-5]\d\d)\b|\b([45]\d\d)\s+(?:Not Found|Forbidden|Unauthorized|Internal Server Error|Bad Gateway|Service Unavailable)/i;

/** « HTTP 404 », « Response code: 500 », « 403 Forbidden » → le statut. */
export function statusFromText(text: string | undefined): number | undefined {
  const match = text ? HTTP_IN_TEXT.exec(text) : null;
  const value = match ? Number(match[1] ?? match[2] ?? match[3]) : NaN;
  return Number.isFinite(value) ? value : undefined;
}

const joined = (...parts: (string | undefined | null)[]) => parts.filter((part): part is string => !!part).join(" — ");

// ── mpv (lecteur avancé du mobile, mpv du bureau) ─────────────────────────

const MPV_DECODE = /unrecognized file format|no audio or video data played|nothing to play|\bunsupported\b|could not decode|codec/i;
const MPV_ENGINE = /output initialization failed|rendu impossible|render context|vo_init|ao_init/i;

/**
 * Le message d'une fin de fichier en erreur (`mpv_error_string`), ou d'un
 * rendu qui ne démarre pas. « loading failed » ne dit pas POURQUOI : ni
 * statut, ni nature — la sonde du flux tranchera.
 */
export function mpvFailure(message: string, engine = "mpv"): EngineFailure {
  const status = statusFromText(message);
  let kind: FailureKind | undefined;
  if (MPV_ENGINE.test(message)) kind = "engine";
  else if (MPV_DECODE.test(message)) kind = "decode";
  else kind = kindFromText(message);
  return { status, kind, engine, message };
}

// ── AVPlayer (lecteur système d'iOS, par react-native-video) ──────────────

/** NSURLErrorDomain → nature. */
const NSURL_KINDS: Record<number, FailureKind> = {
  [-1009]: "network", [-1004]: "network", [-1003]: "network", [-1005]: "network", [-1006]: "network",
  [-1018]: "network", [-1020]: "network", [-1001]: "timeout", [-1022]: "cleartext", [-1100]: "notFound",
  [-1200]: "tls", [-1201]: "tls", [-1202]: "tls", [-1203]: "tls", [-1204]: "tls", [-1205]: "tls", [-1206]: "tls",
};
/** CoreMediaErrorDomain : les refus HTTP d'une ressource HLS. */
const COREMEDIA_STATUS: Record<number, number> = { [-12938]: 404, [-12660]: 403, [-12937]: 401 };
/** Délais et données absentes d'un segment. */
const COREMEDIA_TIMEOUT = new Set([-12889, -12971]);
/** AVFoundationErrorDomain et CoreMedia : format, analyse, décodage. */
const DECODE_CODES = new Set([-11828, -11829, -11821, -11833, -11838, -11839, -12642, -16170, -16172]);

/**
 * Les codes que porte une erreur d'AVFoundation : le sien, et ceux du texte —
 * l'OSStatus d'origine voyage souvent dans la raison d'un -11800
 * (« An unknown error occurred (-12938) »).
 */
function avCodes(code: number | undefined, text: string): number[] {
  const found = (text.match(/-\d{4,6}\b/g) ?? []).map(Number);
  return code === undefined ? found : [code, ...found];
}

export interface AvPlayerErrorInput {
  code?: number;
  domain?: string;
  localizedDescription?: string;
  localizedFailureReason?: string;
  /** react-native-video, sur un échec de chargement de l'élément. */
  error?: string;
}

export function avPlayerFailure(input: AvPlayerErrorInput, engine = "AVPlayer"): EngineFailure {
  const message = joined(input.localizedDescription ?? input.error, input.localizedFailureReason);
  const codes = avCodes(input.code, message);
  let status: number | undefined = statusFromText(message);
  let kind: FailureKind | undefined;
  for (const code of codes) {
    if (status === undefined && COREMEDIA_STATUS[code] !== undefined) status = COREMEDIA_STATUS[code];
    if (kind === undefined && NSURL_KINDS[code] !== undefined) kind = NSURL_KINDS[code];
    if (kind === undefined && COREMEDIA_TIMEOUT.has(code)) kind = "timeout";
    if (kind === undefined && DECODE_CODES.has(code)) kind = "decode";
  }
  kind ??= kindFromText(message);
  const code = input.code !== undefined ? `${input.domain ?? ""} ${input.code}`.trim() : undefined;
  return { status, kind, engine, code, message };
}

// ── ExoPlayer (lecteur système d'Android, par react-native-video) ─────────

/** Les codes de `PlaybackException` (react-native-video les préfixe d'un « 2 »). */
const EXO_KINDS: Record<number, FailureKind> = {
  1003: "timeout", 2001: "network", 2002: "timeout", 2005: "notFound", 2007: "cleartext",
  3001: "decode", 3002: "decode", 3003: "decode", 3004: "decode",
  4001: "decode", 4002: "decode", 4003: "decode", 4004: "decode", 4005: "decode",
  5001: "decode", 5002: "decode",
};
const EXO_NAMES: [RegExp, FailureKind][] = [
  [/ERROR_CODE_IO_NETWORK_CONNECTION_FAILED/, "network"],
  [/ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT|ERROR_CODE_TIMEOUT/, "timeout"],
  [/ERROR_CODE_IO_FILE_NOT_FOUND/, "notFound"],
  [/ERROR_CODE_IO_CLEARTEXT_NOT_PERMITTED/, "cleartext"],
  [/ERROR_CODE_PARSING_|ERROR_CODE_DECOD|ERROR_CODE_AUDIO_TRACK/, "decode"],
];

export interface ExoPlayerErrorInput {
  errorString?: string;
  errorException?: string;
  errorCode?: string;
}

/** « 22004 » → 2004 (react-native-video préfixe le code de `PlaybackException`). */
export function exoCodeOf(raw: string | undefined): number | undefined {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return raw.length === 5 && raw.startsWith("2") ? Number(raw.slice(1)) : value;
}

export function exoPlayerFailure(input: ExoPlayerErrorInput, engine = "ExoPlayer"): EngineFailure {
  const message = joined(input.errorString, input.errorException);
  const code = exoCodeOf(input.errorCode);
  let kind: FailureKind | undefined = code !== undefined ? EXO_KINDS[code] : undefined;
  kind ??= EXO_NAMES.find(([pattern]) => pattern.test(message))?.[1];
  kind ??= kindFromText(message);
  return { status: statusFromText(message), kind, engine, code: input.errorCode, message };
}

/**
 * Une erreur de react-native-video, quel que soit le système : la forme
 * d'Android (`errorCode`, `errorString`) ou celle d'iOS (`code`, `domain`).
 */
export function nativeVideoFailure(event: unknown): EngineFailure {
  const payload = (typeof event === "object" && event !== null ? (event as { error?: unknown }).error ?? event : {}) as
    Record<string, unknown>;
  const text = (key: string) => (typeof payload[key] === "string" ? (payload[key] as string) : undefined);
  if (text("errorCode") !== undefined || text("errorString") !== undefined) {
    return exoPlayerFailure({ errorString: text("errorString"), errorException: text("errorException"), errorCode: text("errorCode") });
  }
  return avPlayerFailure({
    code: typeof payload.code === "number" ? payload.code : undefined,
    domain: text("domain"),
    localizedDescription: text("localizedDescription"),
    localizedFailureReason: text("localizedFailureReason"),
    error: text("error"),
  });
}

// ── hls.js et <video> (web) ───────────────────────────────────────────────

export interface HlsErrorInput {
  type?: string;
  details?: string;
  response?: { code?: number; text?: string };
  reason?: string;
  error?: { message?: string };
}

export function hlsFailure(input: HlsErrorInput, engine = "hls.js"): EngineFailure {
  const details = input.details ?? "";
  const responseCode = input.response?.code;
  const status = responseCode !== undefined && responseCode > 0 ? responseCode : undefined;
  let kind: FailureKind | undefined;
  if (/TimeOut$/i.test(details)) kind = "timeout";
  else if (input.type === "networkError" && status === undefined) kind = "network";
  else if (input.type === "mediaError" || input.type === "muxError" || /parsing|incompatible|bufferAppend/i.test(details)) kind = "decode";
  const message = joined(details, input.reason, input.error?.message);
  return { status, kind: kind ?? kindFromText(message), engine, code: details || undefined, message };
}

/** `MediaError.code` : 1 abandon, 2 réseau, 3 décodage, 4 source refusée (format ou adresse : la sonde tranchera). */
const MEDIA_ERROR_KINDS: Record<number, FailureKind | undefined> = { 1: "aborted", 2: "network", 3: "decode", 4: undefined };
const MEDIA_ERROR_NAMES: Record<number, string> = {
  1: "MEDIA_ERR_ABORTED", 2: "MEDIA_ERR_NETWORK", 3: "MEDIA_ERR_DECODE", 4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
};

export function mediaElementFailure(code: number | undefined, message?: string, engine = "HTML5"): EngineFailure {
  const kind = code !== undefined ? MEDIA_ERROR_KINDS[code] : undefined;
  return {
    status: statusFromText(message),
    kind: kind ?? kindFromText(message),
    engine,
    code: code !== undefined ? MEDIA_ERROR_NAMES[code] ?? String(code) : undefined,
    message,
  };
}
