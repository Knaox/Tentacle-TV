/**
 * Octave — les titres qu'un import de FICHIERS a créés, dans l'ordre où ils entrent dans une playlist (règle pure).
 *
 * Chaque fichier audio du job dit son titre (`trackId`, celui retrouvé pour un doublon) ; une archive ZIP n'en dit
 * qu'un, ou aucun : ses titres sont ceux des albums du job. L'ordre est celui des ALBUMS (disque, puis piste, tel
 * que l'extension les sert), album par album dans l'ordre du job ; un titre qu'aucun album relu ne porte (un
 * doublon rangé ailleurs, un album illisible) suit, dans l'ordre des fichiers.
 */

import type { MusicAlbum, ReleaseImportJob } from "@tentacle-tv/shared/music";
import { isReleaseArchive } from "../releases/releaseModel";

/** Les titres créés (ou retrouvés) par les fichiers du job, dans l'ordre des fichiers. */
export function releaseTrackIds(job: ReleaseImportJob | null | undefined): string[] {
  const ids: string[] = [];
  for (const file of job?.files ?? []) {
    if ((file.state === "read" || file.state === "duplicate") && file.trackId && !ids.includes(file.trackId)) ids.push(file.trackId);
  }
  return ids;
}

/** Le lot portait-il une archive (ses titres ne se lisent qu'aux albums) ? */
export function releaseHadArchive(job: ReleaseImportJob | null | undefined): boolean {
  return (job?.files ?? []).some((f) => f.state === "read" && isReleaseArchive(f.name, null));
}

/**
 * `albums` : les albums du job RELUS avec leurs titres (`null` : illisible). Un album d'une archive entre en entier ;
 * un autre, seulement pour les titres de CE lot (un album complété garde ses anciens titres hors de la playlist).
 */
export function releasePlaylistOrder(job: ReleaseImportJob, albums: readonly (MusicAlbum | null)[]): string[] {
  const fromFiles = releaseTrackIds(job);
  const wanted = new Set(fromFiles);
  const archive = releaseHadArchive(job);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const album of albums) {
    for (const track of album?.tracks ?? []) {
      const id = track.external?.id;
      if (!id || seen.has(id) || !(archive || wanted.has(id))) continue;
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of fromFiles) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}
