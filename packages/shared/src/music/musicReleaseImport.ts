/**
 * Octave — l'IMPORT D'UNE SORTIE hors catalogue : une sortie qu'aucune source de l'extension ne trouve (un album
 * vendu sur Bandcamp, une édition spéciale) entre dans Octave par son LIEN (page Bandcamp d'un album ou d'un
 * titre) ou par ses FICHIERS audio. C'est l'extension qui lit la source et crée l'album, au compte qui l'importe
 * (contrat `lot-sf/contrat-sorties.md`) ; le cœur relaie, les clients envoient et suivent.
 *
 * La fonction se lit sur le contrat `music` déclaré (`releases`, `releaseSources`, pluginMusicContract.ts) : une
 * extension ou un serveur d'avant ne les déclarent pas, et rien ne s'affiche. Les clés et les valeurs de ce
 * fichier traversent le réseau : jamais renommées.
 */

import type { MusicAlbum } from "./musicTypes";

/** Ce que l'extension sait importer, liste FERMÉE. */
export type ReleaseImportSource = "bandcamp" | "files";
export const RELEASE_IMPORT_SOURCES: readonly ReleaseImportSource[] = ["bandcamp", "files"];

/** Refus d'un import, liste FERMÉE : les clients ont leurs mots pour chacun. */
export type ReleaseImportRefusal =
  | "unsupported"
  | "notFound"
  | "unavailable"
  | "budget"
  | "forbidden"
  | "tooLarge"
  | "unreadable"
  | "failed";
export const RELEASE_IMPORT_REFUSALS: readonly ReleaseImportRefusal[] = ["unsupported", "notFound", "unavailable", "budget", "forbidden", "tooLarge", "unreadable", "failed"];

export function readReleaseRefusal(value: unknown): ReleaseImportRefusal {
  return RELEASE_IMPORT_REFUSALS.find((r) => r === value) ?? "failed";
}

/** Un fichier annoncé avant l'envoi. */
export interface ReleaseFileAnnounce {
  name: string;
  size: number;
  /** Type MIME tel que le système le donne (peut être vide). */
  type: string;
}

export type ReleaseFileState = "waiting" | "receiving" | "read" | "duplicate" | "refused";

export interface ReleaseImportFile {
  uploadId: string;
  name: string;
  size: number;
  /** Octets reçus par le serveur (reprise : on repart de là). */
  received: number;
  state: ReleaseFileState;
  refusal?: ReleaseImportRefusal;
}

export type ReleaseJobState = "receiving" | "reading" | "done" | "failed";

/** Un import : celui d'un lien, ou un LOT de fichiers. */
export interface ReleaseImportJob {
  jobId: string;
  source: ReleaseImportSource;
  state: ReleaseJobState;
  files?: ReleaseImportFile[];
  /** Les albums créés ou complétés (un lot peut en faire plusieurs) ; ouvrables par le point `album`. */
  albums: MusicAlbum[];
  refusal?: ReleaseImportRefusal;
}

/** Les albums importés du compte (rangée « Importés »). */
export interface ReleaseImportList {
  albums: MusicAlbum[];
}

/** Un morceau envoyé au plus (le relais du cœur borne une requête à 32 Mo). */
export const RELEASE_CHUNK_BYTES = 8 * 1024 * 1024;
/** Un fichier au plus (un FLAC d'un long titre tient largement). */
export const RELEASE_FILE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
/** Fichiers par lot. */
export const RELEASE_FILES_MAX = 100;

const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "mp4", "flac", "ogg", "oga", "opus", "wav", "aif", "aiff"];

/** Types offerts au sélecteur de fichiers (le serveur juge en dernier, d'après les octets). */
export const RELEASE_AUDIO_ACCEPT = ["audio/*", ...AUDIO_EXTENSIONS.map((e) => `.${e}`)];

/** Un fichier qu'il vaut la peine d'envoyer : un type audio, ou une extension connue. */
export function isImportableAudio(name: string, type: string | null | undefined): boolean {
  if (type && type.startsWith("audio/")) return true;
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return !!ext && AUDIO_EXTENSIONS.includes(ext);
}

/** Les morceaux qui restent à envoyer, depuis ce que le serveur a déjà reçu. */
export function remainingChunks(size: number, received: number, chunk = RELEASE_CHUNK_BYTES): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (let start = Math.max(0, Math.min(received, size)); start < size; start += chunk) out.push({ start, end: Math.min(size, start + chunk) });
  return out;
}

/** Avancement d'un import, de 0 à 1 : les octets envoyés pèsent 90 %, la lecture le reste. */
export function releaseJobFraction(job: Pick<ReleaseImportJob, "state" | "files">, sentBytes?: number): number {
  if (job.state === "done" || job.state === "failed") return 1;
  const files = job.files ?? [];
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total === 0) return job.state === "reading" ? 0.5 : 0.05;
  const sent = Math.min(total, sentBytes ?? files.reduce((sum, f) => sum + Math.min(f.received, f.size), 0));
  return Math.min(0.98, (sent / total) * 0.9 + (job.state === "reading" ? 0.05 : 0));
}

/* ── Liens Bandcamp ── */

const BANDCAMP_HOST = /^(?:[a-z0-9-]+\.)?bandcamp\.com$/i;
const BANDCAMP_PATH = /^\/(?:album|track)\/[A-Za-z0-9._~%-]+\/?$/;

/** Un lien de page d'album ou de titre Bandcamp, normalisé (sans requête ni ancre) ; `null` sinon. */
export function recognizeBandcampUrl(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!BANDCAMP_HOST.test(url.hostname) || !BANDCAMP_PATH.test(url.pathname)) return null;
  return `https://${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
}

const CANDIDATE = /https?:\/\/[^\s<>"'«»]+/gi;
const TRAILING = /[.,;:!?)\]}…]+$/;

/** Le premier lien Bandcamp d'un texte partagé (« Écoute … sur Bandcamp https://… ») ; `null` s'il n'y en a pas. */
export function sharedReleaseLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  for (const match of raw.slice(0, 4096).matchAll(CANDIDATE)) {
    const link = recognizeBandcampUrl(match[0].replace(TRAILING, ""));
    if (link) return link;
  }
  return null;
}
