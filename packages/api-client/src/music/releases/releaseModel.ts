/**
 * Octave — ce que les CLIENTS décident de l'import de sorties (contrat : `@tentacle-tv/shared/music` ›
 * musicReleases.ts) : quels fichiers proposer, quels morceaux restent à envoyer, où en est l'import.
 */

import {
  releaseArtSized,
  RELEASE_COVER_EXTENSIONS,
  RELEASE_COVER_MIME_TYPES,
  RELEASE_FILE_EXTENSIONS,
  RELEASE_FILE_MIME_TYPES,
  type MusicAlbum,
  type ReleaseImportJob,
  type ReleaseRefusal,
} from "@tentacle-tv/shared/music";

/** Un morceau d'envoi quand le job ne dit pas le sien (le relais du cœur borne une requête à 32 Mo). */
export const RELEASE_DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;

const REFUSALS: readonly ReleaseRefusal[] = ["unsupported", "notFound", "unavailable", "budget", "forbidden", "tooLarge", "quota", "tooMany", "unsupportedFormat", "unreadable", "expired", "failed"];

/** Un code de refus lu sur le réseau ; inconnu : `failed`. */
export function readReleaseRefusal(value: unknown): ReleaseRefusal {
  return REFUSALS.find((r) => r === value) ?? "failed";
}

/** Une image jointe au lot devient la pochette (≤ 25 Mo, contrat des sorties) ; au-delà, elle n'est pas envoyée. */
export const RELEASE_COVER_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Ce que le sélecteur de fichiers propose : l'audio ET les images (le `cover.png` d'un téléchargement Bandcamp
 * devient la pochette). Le serveur juge en dernier, sur le contenu.
 */
export const RELEASE_ACCEPT: readonly string[] = [
  "audio/*",
  ...RELEASE_FILE_MIME_TYPES,
  ...RELEASE_FILE_EXTENSIONS.map((e) => `.${e}`),
  ...RELEASE_COVER_MIME_TYPES,
  ...RELEASE_COVER_EXTENSIONS.map((e) => `.${e}`),
  "application/zip",
  ".zip",
];

/** Les types d'une archive ZIP (le téléchargement d'un achat Bandcamp), envoyée telle quelle : le serveur l'ouvre. */
export const RELEASE_ARCHIVE_MIME_TYPES: readonly string[] = ["application/zip", "application/x-zip-compressed", "application/x-zip"];

const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** Un fichier audio : un type audio, ou une extension connue. */
export function isImportableAudio(name: string, type: string | null | undefined): boolean {
  if (type && type.startsWith("audio/")) return true;
  return RELEASE_FILE_EXTENSIONS.includes(extensionOf(name));
}

/** Une image de pochette (JPEG, PNG, WebP), par type ou par extension. */
export function isReleaseCover(name: string, type: string | null | undefined): boolean {
  if (type && RELEASE_COVER_MIME_TYPES.includes(type)) return true;
  return RELEASE_COVER_EXTENSIONS.includes(extensionOf(name));
}

/** Une archive ZIP, par type ou par extension. */
export function isReleaseArchive(name: string, type: string | null | undefined): boolean {
  if (type && RELEASE_ARCHIVE_MIME_TYPES.includes(type)) return true;
  return extensionOf(name) === "zip";
}

/** Ce qui porte des titres : un fichier audio, ou une archive (son audio est lu par le serveur). */
const carriesTracks = (name: string, type: string | null | undefined) => isImportableAudio(name, type) || isReleaseArchive(name, type);

/** Ce qui part dans un lot : l'audio, les archives ZIP, et les images de pochette de 25 Mo au plus. */
export function isReleaseLotFile(name: string, type: string | null | undefined, size: number): boolean {
  return carriesTracks(name, type) || (isReleaseCover(name, type) && size <= RELEASE_COVER_MAX_BYTES);
}

/**
 * Le tri d'un choix de fichiers : ce qui part (audio, ZIP et images de pochette, 100 au plus — l'audio d'abord, une image
 * ne prend jamais la place d'un titre), ce qui est laissé de côté, et si la borne a coupé.
 */
export function pickReleaseLot<F extends { name: string; type: string; size: number }>(all: readonly F[], max: number): { files: F[]; ignored: number; truncated: boolean; audio: number; covers: number } {
  const audio = all.filter((f) => carriesTracks(f.name, f.type));
  const covers = all.filter((f) => !carriesTracks(f.name, f.type) && isReleaseLotFile(f.name, f.type, f.size));
  const kept = [...audio, ...covers];
  const files = kept.slice(0, max);
  return {
    files,
    ignored: all.length - kept.length,
    truncated: kept.length > max,
    audio: files.filter((f) => carriesTracks(f.name, f.type)).length,
    covers: files.filter((f) => !carriesTracks(f.name, f.type)).length,
  };
}

/** Les morceaux qui restent à envoyer, depuis ce que le serveur a déjà reçu. */
export function remainingChunks(size: number, received: number, chunk = RELEASE_DEFAULT_CHUNK_BYTES): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const step = chunk > 0 ? chunk : RELEASE_DEFAULT_CHUNK_BYTES;
  for (let start = Math.max(0, Math.min(received, size)); start < size; start += step) out.push({ start, end: Math.min(size, start + step) });
  return out;
}

/** Avancement d'un import, de 0 à 1 : les octets envoyés pèsent 90 %, la lecture le reste ; jamais 1 avant la fin. */
export function releaseFraction(job: Pick<ReleaseImportJob, "state" | "files"> | null, sentBytes: number, totalBytes: number): number {
  if (!job) return 0.02;
  if (job.state === "done" || job.state === "failed") return 1;
  if (totalBytes <= 0) return job.state === "reading" ? 0.5 : 0.05;
  return Math.min(0.98, (Math.min(sentBytes, totalBytes) / totalBytes) * 0.9 + (job.state === "reading" ? 0.05 : 0));
}

/**
 * Le nom d'album à proposer pour un lot SANS tag d'album (`albumHint`) : le dossier commun des fichiers quand le
 * système le donne (« Bastien Becker/Édition spéciale/01.flac »), sinon rien — le serveur range alors en
 * « Importés ».
 */
export function albumHintOf(paths: readonly (string | null | undefined)[]): string | undefined {
  const folders = paths.map((p) => p?.split("/").slice(-2, -1)[0]?.trim()).filter((f): f is string => !!f);
  if (folders.length === 0 || folders.length !== paths.length) return undefined;
  return folders.every((f) => f === folders[0]) && folders[0].length <= 200 ? folders[0] : undefined;
}

/** L'album où mener à la fin d'un import : celui du `focus` du job, sinon le premier créé ; `null` : rien de neuf. */
export function releaseArrival(job: Pick<ReleaseImportJob, "albums" | "focus"> | null): MusicAlbum | null {
  if (!job) return null;
  return job.albums.find((a) => a.external?.id === job.focus?.albumId) ?? job.albums[0] ?? null;
}

/**
 * La taille d'une pochette IMPORTÉE pour une place de `pixels` pixels réels (taille × densité) : la plus petite
 * qui la couvre (300, 700, 1200), sinon l'originale. Toute autre adresse : telle quelle.
 */
export function releaseArtForPixels(url: string, pixels: number): string {
  const size = pixels <= 300 ? "300" : pixels <= 700 ? "700" : pixels <= 1200 ? "1200" : "full";
  return releaseArtSized(url, size);
}

/** Ce qu'un lot a donné, fichier par fichier : lus, déjà là (même contenu), refusés — à dire en fin d'import. */
export function releaseFileCounts(job: Pick<ReleaseImportJob, "files"> | null): { read: number; duplicate: number; refused: number } {
  const out = { read: 0, duplicate: 0, refused: 0 };
  for (const file of job?.files ?? []) {
    if (file.state === "read" || file.state === "duplicate" || file.state === "refused") out[file.state]++;
  }
  return out;
}
