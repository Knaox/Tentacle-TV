/**
 * Octave — ce que les CLIENTS décident de l'import de sorties (contrat : `@tentacle-tv/shared/music` ›
 * musicReleases.ts) : quels fichiers proposer, quels morceaux restent à envoyer, où en est l'import.
 */

import {
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

/** Ce que le sélecteur de fichiers propose (le serveur juge en dernier, sur le contenu). */
export const RELEASE_ACCEPT: readonly string[] = ["audio/*", ...RELEASE_FILE_MIME_TYPES, ...RELEASE_FILE_EXTENSIONS.map((e) => `.${e}`)];

/** Un fichier qu'il vaut la peine d'envoyer : un type audio, ou une extension connue. */
export function isImportableAudio(name: string, type: string | null | undefined): boolean {
  if (type && type.startsWith("audio/")) return true;
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return !!ext && RELEASE_FILE_EXTENSIONS.includes(ext);
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
