/**
 * Octave — des `File` du navigateur (choix ou dépôt) en fichiers d'import : la tranche se lit par `Blob.slice`
 * (rien n'est chargé en mémoire en entier). Les fichiers non audio sont écartés ICI (le serveur juge en dernier).
 */

import { albumHintOf, isImportableAudio, type ReleaseLocalFile } from "@tentacle-tv/api-client";
import { RELEASE_FILES_PER_JOB } from "@tentacle-tv/shared/music";

export interface PickedFiles {
  files: File[];
  ignored: number;
  /** Plus que ce qu'un import accepte : les premiers sont gardés. */
  truncated: boolean;
}

export function pickAudio(list: Iterable<File>): PickedFiles {
  const all = [...list];
  const audio = all.filter((f) => isImportableAudio(f.name, f.type));
  return { files: audio.slice(0, RELEASE_FILES_PER_JOB), ignored: all.length - audio.length, truncated: audio.length > RELEASE_FILES_PER_JOB };
}

export function toLocalFiles(files: readonly File[]): ReleaseLocalFile[] {
  return files.map((file) => ({ name: file.name, size: file.size, type: file.type, read: async (start, end) => file.slice(start, end) }));
}

/** Le dossier commun d'un dépôt de dossier (`webkitRelativePath`) : le nom d'album des fichiers sans tag. */
export function albumHintOfFiles(files: readonly File[]): string | undefined {
  return albumHintOf(files.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || null));
}

/** 1,2 Mo, 640 Ko : une taille lisible dans la langue de l'interface. */
export function formatBytes(bytes: number, lang: string): string {
  const units = lang.startsWith("fr") ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0 }).format(value)} ${units[unit]}`;
}
