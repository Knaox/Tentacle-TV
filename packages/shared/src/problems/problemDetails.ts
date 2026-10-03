import type { ProblemDetail, ProblemModel } from "./problemTypes";

/**
 * Les détails techniques d'une erreur — repliés sous « Détails », avec
 * « Copier » : la seule trace qu'un spectateur puisse transmettre à
 * l'administrateur. Jamais un secret : les jetons sont masqués dans les
 * adresses et les messages AVANT d'être montrés ou copiés.
 */

/** Ce qu'on sait de l'échec, au moment où il arrive. */
export interface ProblemFacts {
  /** Le statut HTTP de la réponse en échec. */
  status?: number;
  /** La réponse de la sonde du fichier source (404 : plus sur le disque). */
  sourceStatus?: number;
  /** Le moteur de lecture (« mpv », « AVPlayer », « ExoPlayer », « hls.js », « HTML5 »). */
  engine?: string;
  /** Le code natif (« -1009 », « 2001 », « MEDIA_ERR_DECODE »). */
  code?: string | number;
  /** Le `ErrorCode` de PlaybackInfo (« NoCompatibleStream »). */
  jellyfinErrorCode?: string;
  /** Ce qu'on demandait (« POST /Items/…/PlaybackInfo »), sans jeton. */
  request?: string;
  /** Le message brut. */
  message?: string;
  /** La forme du flux. */
  stream?: "direct" | "transcode" | "local";
  /** L'application et sa version (« Tentacle mobile 1.10.3 · iOS 26.3 »). */
  app?: string;
}

const SECRET_PARAMS = /([?&](?:api_key|apikey|api-key|access_token|token|x-emby-token|deviceid|playsessionid)=)[^&#\s"']+/gi;
const SECRET_HEADERS = /\b(x-emby-token|authorization|x-mediabrowser-token)\s*[:=]\s*(?:(?:Bearer|Basic)\s+)?("[^"]*"|[^\s,;]+)/gi;
const BEARER = /\b(Bearer)\s+[\w.~+/=-]+/gi;
const EMBY_TOKEN = /(Token=")[^"]*(")/gi;

/** Le texte, jetons masqués (paramètres d'adresse, en-têtes, « Bearer … »). */
export function redactSecrets(text: string): string {
  return text
    .replace(SECRET_PARAMS, "$1•••")
    .replace(EMBY_TOKEN, "$1•••$2")
    .replace(SECRET_HEADERS, "$1: •••")
    .replace(BEARER, "$1 •••");
}

/** Un message brut, sans secret ni longueur démesurée. */
function cleanMessage(message: string): string {
  const flat = redactSecrets(message).replace(/\s+/g, " ").trim();
  return flat.length > 300 ? `${flat.slice(0, 297)}…` : flat;
}

const STREAM_KEYS = { direct: "errors:streamDirect", transcode: "errors:streamTranscode", local: "errors:streamLocal" } as const;

/** Les lignes des détails, dans l'ordre où l'administrateur les lit. */
export function problemDetails(facts: ProblemFacts): ProblemDetail[] {
  const lines: ProblemDetail[] = [];
  if (facts.status !== undefined) lines.push({ key: "errors:detailHttp", values: { status: facts.status } });
  if (facts.sourceStatus !== undefined) lines.push({ key: "errors:detailSource", values: { status: facts.sourceStatus } });
  if (facts.jellyfinErrorCode) lines.push({ key: "errors:detailJellyfin", values: { code: facts.jellyfinErrorCode } });
  if (facts.engine) lines.push({ key: "errors:detailEngine", values: { engine: facts.engine } });
  if (facts.stream) lines.push({ key: "errors:detailStream", values: { stream: STREAM_KEYS[facts.stream] } });
  if (facts.code !== undefined && facts.code !== "") lines.push({ key: "errors:detailCode", values: { code: String(facts.code) } });
  if (facts.request) lines.push({ key: "errors:detailRequest", values: { request: cleanMessage(facts.request) } });
  if (facts.message) lines.push({ key: "errors:detailMessage", values: { message: cleanMessage(facts.message) } });
  if (facts.app) lines.push({ key: "errors:detailApp", values: { app: facts.app } });
  return lines;
}

/** Une traduction : la plateforme passe son `t`. */
export type ProblemTranslate = (key: string, values?: Record<string, string | number>) => string;

/** Une ligne de détail traduite — une valeur qui est elle-même une clé (`stream`) est traduite aussi. */
export function detailText(detail: ProblemDetail, t: ProblemTranslate): string {
  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(detail.values)) {
    values[name] = typeof value === "string" && value.startsWith("errors:") ? t(value) : value;
  }
  return t(detail.key, values);
}

/** Le texte que « Copier » met dans le presse-papiers : quoi, pourquoi, puis les détails. */
export function problemCopyText(model: Pick<ProblemModel, "titleKey" | "reasonKey" | "values" | "details">, t: ProblemTranslate): string {
  return [t(model.titleKey), t(model.reasonKey, model.values), ...model.details.map((detail) => detailText(detail, t))].join("\n");
}
