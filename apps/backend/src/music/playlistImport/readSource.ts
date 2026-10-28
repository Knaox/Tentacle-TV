/**
 * Octave — de ce que l'utilisateur a donné (un lien, une liste collée, une
 * playlist déjà lue par une extension) à une `ImportedPlaylist`. Un lien
 * court (spotify.link, link.deezer.com) est suivi par la porte réseau, puis
 * RECONNU à nouveau : seule une adresse de la liste fermée est jamais lue.
 */

import { CORE_IMPORT_SOURCES, MUSIC_IMPORT_LIMITS, recognizeImportUrl, type ImportedPlaylist, type RecognizedImportUrl } from "../contract/musicImport";
import { ImportFetchError, type ImportFetcher } from "./importFetch";
import { ImportReadFailure } from "./readers/readerKit";
import { readApple } from "./readers/appleReader";
import { readDeezer } from "./readers/deezerReader";
import { readSpotify } from "./readers/spotifyReader";
import { readText } from "./readers/textReader";
import { readTentacleShare } from "./readers/tentacleReader";
import { createShareFetcher, type ShareFetcher } from "./shareFetch";
import { sanitizePlaylist } from "./importInput";
import { isCapabilityDeclared } from "../../serverCapabilities/declaredCapabilities";
import type { SharedMusicPlaylist } from "../contract/musicShare";
import { loadShareDocument } from "../playlistShare/shareDocument";

/** Ce que la route a validé (importInput.ts). */
export type ImportInput = { kind: "url"; url: RecognizedImportUrl } | { kind: "text"; text: string } | { kind: "playlist"; playlist: ImportedPlaylist };

async function expandShort(fetcher: ImportFetcher, short: RecognizedImportUrl): Promise<RecognizedImportUrl> {
  const page = await fetcher(short.url, "html");
  const target = recognizeImportUrl(page.url);
  if (!target || target.kind === "short" || target.source !== short.source) throw new ImportReadFailure(page.status === 404 ? "notFound" : "unsupported");
  return target;
}

async function readUrl(fetcher: ImportFetcher, given: RecognizedImportUrl, share: ShareFetcher): Promise<ImportedPlaylist> {
  // Un lien de partage d'un autre serveur Tentacle : sa seule route publique, par la porte gardée.
  if (given.source === "tentacle") {
    if (!isCapabilityDeclared("music.playlistShare")) throw new ImportReadFailure("unsupported");
    return readTentacleShare(share, given.url, given.id, localShare);
  }
  const url = given.kind === "short" ? await expandShort(fetcher, given) : given;
  if (!CORE_IMPORT_SOURCES.includes(url.source) || url.kind === "short") throw new ImportReadFailure("unsupported");
  if (url.source === "spotify") return readSpotify(fetcher, url.kind, url.id);
  if (url.source === "apple") return readApple(fetcher, url.kind, url.url);
  return readDeezer(fetcher, url.kind, url.id);
}

let defaultShareFetcher: ShareFetcher | null = null;

/** Le document d'un lien de CE serveur (`null` : le jeton n'est pas d'ici, ou plus servi). */
async function localShare(token: string): Promise<SharedMusicPlaylist | null> {
  const result = await loadShareDocument(token);
  return result.ok ? result.document : null;
}

export async function readSource(fetcher: ImportFetcher, input: ImportInput, share?: ShareFetcher): Promise<ImportedPlaylist> {
  try {
    if (input.kind === "text") return readText(input.text);
    if (input.kind === "playlist") return sanitizePlaylist(input.playlist);
    const playlist = await readUrl(fetcher, input.url, share ?? (defaultShareFetcher ??= createShareFetcher()));
    return { ...playlist, tracks: playlist.tracks.slice(0, MUSIC_IMPORT_LIMITS.tracks) };
  } catch (error) {
    if (error instanceof ImportReadFailure) throw error;
    if (error instanceof ImportFetchError) throw new ImportReadFailure(error.reason === "host" ? "unsupported" : "unavailable");
    throw new ImportReadFailure("unavailable");
  }
}
