import { redactSecrets } from "./problemDetails";
import type { ProblemModel, ProblemSeverity } from "./problemTypes";

/**
 * Le contexte de diagnostic d'une erreur — ce que « Signaler un problème »
 * joindra demain (le bouton n'existe pas encore : `docs/lot-mobile-1020/erreurs.md`,
 * « API du futur bouton »). STRUCTURÉ et SANS SECRET : jamais un jeton, un mot
 * de passe, une adresse signée ni une adresse de serveur — seulement ce qui
 * aide à comprendre (code, écran, plateforme, versions, moteur, décision de
 * transcodage, session de lecture, heure). Pur : chaque plateforme fournit
 * son environnement, le journal (`problemJournal.ts`) garde les derniers.
 */

/** Ce que la plateforme sait d'elle-même, une fois pour toutes. */
export interface ProblemEnvironment {
  /** « ios », « android », « web », « desktop-macos »… */
  platform: string;
  /** « 26.3 », « 15 » — la version du système. */
  osVersion?: string;
  /** Le format de l'appareil : « phone », « tablet », « desktop », « tv ». */
  formFactor?: string;
  /** La version de l'app (« 1.10.3 ») et son numéro de build. */
  appVersion?: string;
  appBuild?: string;
  /** La version du serveur Tentacle, telle que `/api/config` la dit. */
  serverVersion?: string;
}

/** Ce que le lecteur sait de la lecture en cours (vide hors lecture). */
export interface PlaybackDiagnostic {
  /** « mpv », « AVPlayer », « ExoPlayer », « cast »… */
  engine?: string;
  /** La décision du serveur : lecture directe, copie du flux, conversion. */
  playMethod?: "DirectPlay" | "DirectStream" | "Transcode" | "Local";
  /** Les raisons de la conversion que Jellyfin donne (`TranscodeReasons`), codes seulement. */
  transcodeReasons?: string[];
  /** Le palier de qualité choisi (« auto », « 1080p-8 »…). */
  quality?: string;
  /** L'identifiant de la session de lecture Jellyfin (`PlaySessionId`). */
  playSessionId?: string;
  /** Le titre lu (identifiant Jellyfin, jamais son nom). */
  itemId?: string;
}

/** Une entrée du journal : une erreur montrée, et son contexte. */
export interface ProblemDiagnostic {
  /** Le code du support (`playbackStart/transcodeFailed`). */
  code: string;
  severity: ProblemSeverity;
  /** L'heure, en ISO 8601 (UTC). */
  at: string;
  /** L'écran (chemin de la route, paramètres retirés : « /media/[id] »). */
  screen?: string;
  environment: ProblemEnvironment;
  playback?: PlaybackDiagnostic;
  /** Les lignes techniques du modèle, déjà sans secret (statut HTTP, code natif…). */
  details: string[];
}

/** Un identifiant n'a que ces caractères : le reste est coupé, pas de texte libre qui s'y glisse. */
const SAFE_ID = /[^A-Za-z0-9._:/@+[\]()-]/g;

/** Un secret écrit en clair dans un texte libre (« token=… », « password: … »). */
const LOOSE_SECRET = /\b(token|access_token|api_?key|password|passwd|pwd|secret|pin)(\s*[=:]\s*)("[^"]*"|[^\s,;&]+)/gi;

/** Toute adresse (http, https, ws…) perd sa requête et son fragment ; l'hôte devient « … ». */
const URL_TEXT = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/?#"']+([^\s?#"']*)(?:[?#][^\s"']*)?/gi;

/** Un texte libre rendu sûr : jetons masqués, adresses dépouillées, longueur bornée. */
export function scrubDiagnosticText(text: string, max = 240): string {
  const flat = redactSecrets(text).replace(LOOSE_SECRET, "$1$2•••").replace(URL_TEXT, "$1…$2").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function safeId(value: string | undefined, max = 80): string | undefined {
  if (!value) return undefined;
  const clean = value.replace(SAFE_ID, "").slice(0, max);
  return clean === "" ? undefined : clean;
}

/** Le chemin d'un écran sans ses paramètres de requête (où un jeton pourrait traîner). */
export function screenOf(pathname: string | undefined): string | undefined {
  if (!pathname) return undefined;
  return safeId(pathname.split(/[?#]/)[0], 120);
}

function cleanEnvironment(env: ProblemEnvironment): ProblemEnvironment {
  return {
    platform: safeId(env.platform, 40) ?? "unknown",
    ...(safeId(env.osVersion, 40) && { osVersion: safeId(env.osVersion, 40) }),
    ...(safeId(env.formFactor, 20) && { formFactor: safeId(env.formFactor, 20) }),
    ...(safeId(env.appVersion, 40) && { appVersion: safeId(env.appVersion, 40) }),
    ...(safeId(env.appBuild, 40) && { appBuild: safeId(env.appBuild, 40) }),
    ...(safeId(env.serverVersion, 40) && { serverVersion: safeId(env.serverVersion, 40) }),
  };
}

function cleanPlayback(playback: PlaybackDiagnostic | undefined): PlaybackDiagnostic | undefined {
  if (!playback) return undefined;
  const clean: PlaybackDiagnostic = {};
  if (safeId(playback.engine, 40)) clean.engine = safeId(playback.engine, 40);
  if (playback.playMethod) clean.playMethod = playback.playMethod;
  const reasons = (playback.transcodeReasons ?? []).map((reason) => safeId(reason, 60)).filter((r): r is string => !!r);
  if (reasons.length > 0) clean.transcodeReasons = reasons.slice(0, 8);
  if (safeId(playback.quality, 40)) clean.quality = safeId(playback.quality, 40);
  if (safeId(playback.playSessionId, 64)) clean.playSessionId = safeId(playback.playSessionId, 64);
  if (safeId(playback.itemId, 64)) clean.itemId = safeId(playback.itemId, 64);
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export interface DiagnosticInput {
  model: Pick<ProblemModel, "code" | "severity" | "details">;
  environment: ProblemEnvironment;
  /** Les lignes des détails déjà traduites (`detailText`), si la plateforme les a. */
  detailLines?: string[];
  screen?: string;
  playback?: PlaybackDiagnostic;
  /** L'horloge (tests). */
  now?: number;
}

/** L'entrée de journal d'un message montré — tout passe par le tamis, rien ne sort brut. */
export function buildProblemDiagnostic(input: DiagnosticInput): ProblemDiagnostic {
  const lines = input.detailLines
    ?? input.model.details.map((detail) => `${detail.key} ${JSON.stringify(detail.values)}`);
  const diagnostic: ProblemDiagnostic = {
    code: safeId(input.model.code, 80) ?? "page/unknown",
    severity: input.model.severity,
    at: new Date(input.now ?? Date.now()).toISOString(),
    environment: cleanEnvironment(input.environment),
    details: lines.map((line) => scrubDiagnosticText(line)).filter(Boolean).slice(0, 12),
  };
  const screen = screenOf(input.screen);
  if (screen) diagnostic.screen = screen;
  const playback = cleanPlayback(input.playback);
  if (playback) diagnostic.playback = playback;
  return diagnostic;
}
