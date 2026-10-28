/**
 * Octave — une playlist PARTAGÉE par un autre serveur Tentacle (source `tentacle`, `musicShare.ts`) : son
 * document public, lu par la porte gardée (`shareFetch.ts`), revérifié champ par champ. L'enregistrement
 * MusicBrainz de chaque titre voyage dans `sourceId` (le rapprochement s'en sert, `importMatching.ts`).
 */

import { MUSIC_IMPORT_LIMITS, type ImportedPlaylist } from "../../contract/musicImport";
import { readSharedPlaylist, sharedImportTracks, type SharedMusicPlaylist } from "../../contract/musicShare";
import type { ShareFetcher } from "../shareFetch";
import { ImportReadFailure } from "./readerKit";

function playlistOf(shared: SharedMusicPlaylist): ImportedPlaylist {
  const tracks = sharedImportTracks(shared).slice(0, MUSIC_IMPORT_LIMITS.tracks);
  if (tracks.length === 0) throw new ImportReadFailure("empty");
  return { source: "tentacle", name: shared.name, tracks, truncated: shared.truncated, artworkUrl: null };
}

/**
 * `local` : le document d'un jeton de CE serveur, s'il en est un (16 octets au hasard : un jeton d'un autre
 * serveur n'y est jamais) — un lien de la maison se lit sans passer par le réseau, dans les mêmes droits.
 */
export async function readTentacleShare(fetcher: ShareFetcher, link: string, token: string, local?: (token: string) => Promise<SharedMusicPlaylist | null>): Promise<ImportedPlaylist> {
  const here = local ? await local(token).catch(() => null) : null;
  if (here) return playlistOf(here);
  const page = await fetcher(link);
  // Révoqué, inconnu, droit perdu : le serveur qui partage dit seulement « indisponible ».
  if (page.status === 404 || page.status === 403) throw new ImportReadFailure("notFound");
  if (page.status !== 200) throw new ImportReadFailure("unavailable");
  let raw: unknown;
  try {
    raw = JSON.parse(page.body);
  } catch {
    throw new ImportReadFailure("unavailable");
  }
  const shared = readSharedPlaylist(raw);
  if (!shared) throw new ImportReadFailure("unavailable");
  return playlistOf(shared);
}
