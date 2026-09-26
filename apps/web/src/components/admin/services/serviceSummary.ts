import type { AdminKeyState } from "../../../lib/adminKeyHealth";
import {
  AdminApiError,
  type AudioAnalysisStatus,
  type DatabaseService,
  type DirectStreamingConfig,
  type JellyfinService,
  type PublicUrlConfig,
} from "./servicesModel";

/**
 * L'état de chaque service en une ligne — ce que montrent les tuiles du
 * résumé et les pastilles des sections. Fonctions pures : la page ne fait que
 * traduire `label` (clé de l'espace `adminServices`).
 */

export type Tone = "success" | "warning" | "error" | "neutral";

export interface Summary {
  tone: Tone;
  /** Clé i18n de l'état. */
  label: string;
  /** Détail brut (version, hôte, outil), affiché tel quel. */
  detail?: string;
  /** Détail à traduire, quand il n'y a rien de brut à montrer. */
  detailKey?: string;
}

export function summarizeJellyfin(jellyfin: JellyfinService, key: AdminKeyState | null): Summary {
  const version = jellyfin.version ? `Jellyfin ${jellyfin.version}` : undefined;
  if (jellyfin.status === "connected") {
    // `/System/Info` répond à n'importe quelle clé valide : une clé sans droits
    // d'administration passe ce test, pas celui du bandeau d'alerte.
    if (key === "revoquee" || key === "sansDroits") return { tone: "warning", label: "jellyfinKeyToReview", detail: version };
    return { tone: "success", label: "jellyfinConnected", detail: version };
  }
  if (jellyfin.status === "error") {
    if (jellyfin.error === "jellyfin-rejected") {
      return { tone: "error", label: "jellyfinRejected", detail: jellyfin.httpStatus ? `HTTP ${jellyfin.httpStatus}` : undefined };
    }
    if (jellyfin.error === "jellyfin-invalid") return { tone: "error", label: "jellyfinNotJellyfin", detail: hostOf(jellyfin.url) };
    return { tone: "error", label: "jellyfinUnreachable", detail: hostOf(jellyfin.url) || undefined };
  }
  return { tone: "warning", label: "jellyfinNotConfigured" };
}

export function summarizeDatabase(database: DatabaseService): Summary {
  const version = formatDatabaseVersion(database.version) || undefined;
  if (database.status === "connected") {
    return database.pendingRestart
      ? { tone: "warning", label: "databaseRestart", detail: version }
      : { tone: "success", label: "databaseConnected", detail: version };
  }
  if (database.status === "error") return { tone: "error", label: "databaseDown", detail: database.fields?.host };
  return { tone: "error", label: "databaseNotConfigured" };
}

export function summarizePublicUrl(config: PublicUrlConfig): Summary {
  return config.effectiveUrl
    ? { tone: "success", label: "publicUrlSet", detail: hostOf(config.effectiveUrl) }
    : { tone: "warning", label: "publicUrlMissing", detailKey: "publicUrlPairingBlocked" };
}

export function summarizeDirectStreaming(config: DirectStreamingConfig): Summary {
  return config.enabled
    ? { tone: "success", label: "directOn", detail: hostOf(config.publicUrl) || undefined }
    : { tone: "neutral", label: "directOff" };
}

export function summarizeAudio(audio: AudioAnalysisStatus): Summary {
  if (audio.tool === null) return { tone: "neutral", label: "audioNoTool" };
  return audio.enabled
    ? { tone: "success", label: "audioOn", detail: audio.tool }
    : { tone: "neutral", label: "audioOff" };
}

/** « 11.4.4-MariaDB-ubu2404 » → « MariaDB 11.4.4 » ; « 8.0.36 » → « MySQL 8.0.36 ». */
export function formatDatabaseVersion(raw: string): string {
  const numbers = raw.match(/^\d+(?:\.\d+){0,2}/)?.[0];
  if (!numbers) return raw;
  return /mariadb/i.test(raw) ? `MariaDB ${numbers}` : `MySQL ${numbers}`;
}

/** L'hôte d'une adresse (port compris), ou la chaîne telle quelle si ce n'en est pas une. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Une adresse absolue en http(s) — ce que le serveur accepte pour Jellyfin et l'URL publique. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
}

/** Un flux en http:// appelé depuis une page https:// : le navigateur le bloquera. */
export function isMixedContent(pageProtocol: string, url: string): boolean {
  return pageProtocol === "https:" && url.trim().toLowerCase().startsWith("http://");
}

/**
 * La saisie de confirmation d'une action irréversible : ni la casse, ni les
 * accents, ni les espaces autour ne doivent la faire échouer — « reinitialiser »
 * vaut « Réinitialiser » sur un clavier qui n'a pas le É.
 */
export function matchesConfirmation(input: string, expected: string): boolean {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLocaleLowerCase();
  return fold(expected) !== "" && fold(input) === fold(expected);
}

/** Des octets en mégaoctets, dans l'unité de la langue (« 14,5 Mo », « 14.5 MB »). */
export function formatMegabytes(bytes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 }).format(bytes / 1e6);
}

/** Une durée en secondes, au plus deux unités : « 16 s », « 2 min 5 s », « 1 h 3 min ». */
export function formatDuration(totalSeconds: number, locale: string): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const unit = (value: number, name: "hour" | "minute" | "second") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "short" }).format(value);
  if (seconds < 60) return unit(seconds, "second");
  if (seconds < 3600) {
    const rest = seconds % 60;
    return rest ? `${unit(Math.floor(seconds / 60), "minute")} ${unit(rest, "second")}` : unit(seconds / 60, "minute");
  }
  const minutes = Math.floor((seconds % 3600) / 60);
  const hours = unit(Math.floor(seconds / 3600), "hour");
  return minutes ? `${hours} ${unit(minutes, "minute")}` : hours;
}

/** La clé i18n (et ses valeurs) qui explique un échec — ou le message brut du serveur. */
export function explainFailure(error: unknown): { key: string; values?: Record<string, unknown> } | { message: string } {
  if (!(error instanceof AdminApiError)) return { key: "errorGeneric" };
  switch (error.code) {
    case "jellyfin-key-missing": return { key: "errorKeyMissing" };
    case "jellyfin-unreachable": return { key: "errorUnreachable" };
    case "jellyfin-invalid": return { key: "errorNotJellyfin" };
    case "jellyfin-rejected": return { key: "errorRejected", values: { status: error.httpStatus ?? error.status } };
    case "invalid-body": return { key: "errorInvalid" };
    // Un serveur d'avant les codes n'envoie que son message, en français.
    default: return error.message ? { message: error.message } : { key: "errorGeneric" };
  }
}
