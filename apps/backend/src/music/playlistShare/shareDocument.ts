/**
 * Octave — ce que lit QUI A LE LIEN : le document public d'une playlist partagée (`SharedMusicPlaylist`),
 * relu À CHAQUE FOIS au nom du propriétaire et dans SES droits du moment — sa playlist telle qu'il la voit,
 * ses bibliothèques. Rien que des métadonnées : jamais un identifiant Jellyfin, un fichier, une image, un
 * jeton. Sans le droit « Partage public » (ou sans accès à la musique), le lien ne sert plus rien ; il revient
 * avec le droit, comme Ma liste.
 */

import { MUSIC_IMPORT_LIMITS } from "../contract/musicImport";
import type { SharedMusicPlaylist } from "../contract/musicShare";
import type { MusicPlaylistDetail } from "../contract/musicCoreApi";
import { mayShareInPublic } from "../../services/share/publicSharingRight";
import { playlistDetail } from "../view/playlistViews";
import { userView, type UserView } from "../view/viewContext";
import { shareByToken, type ShareRecord } from "./shareStore";

export type ShareDocumentResult = { ok: true; document: SharedMusicPlaylist; share: ShareRecord } | { ok: false; reason: "not_found" | "unavailable" };

export interface ShareDocumentDeps {
  find: (token: string) => Promise<ShareRecord | null>;
  mayShare: (userId: string) => Promise<boolean>;
  view: (userId: string) => Promise<UserView>;
  detail: (view: UserView, playlistId: string) => Promise<MusicPlaylistDetail | null>;
}

const DEFAULT_DEPS: ShareDocumentDeps = { find: shareByToken, mayShare: mayShareInPublic, view: userView, detail: playlistDetail };

/** La playlist vue par son propriétaire → le document public (pur). */
export function sharedDocumentOf(detail: MusicPlaylistDetail, ownerName: string): SharedMusicPlaylist {
  const tracks = detail.entries.slice(0, MUSIC_IMPORT_LIMITS.tracks).map(({ track }) => ({
    title: track.title,
    artists: track.artists.map((a) => a.name).filter((name) => name.length > 0),
    album: track.album?.title ?? null,
    durationMs: track.durationMs,
    recording: track.mbids.recording,
  }));
  return {
    v: 1,
    name: detail.name,
    description: detail.description ?? null,
    ownerName,
    total: detail.entries.length,
    truncated: detail.entries.length > tracks.length,
    tracks,
  };
}

export async function loadShareDocument(token: string, deps: ShareDocumentDeps = DEFAULT_DEPS): Promise<ShareDocumentResult> {
  const share = await deps.find(token);
  if (!share) return { ok: false, reason: "not_found" };
  if (!(await deps.mayShare(share.ownerUserId))) return { ok: false, reason: "unavailable" };
  const view = await deps.view(share.ownerUserId);
  // Le propriétaire ne voit plus la musique, ou plus cette playlist : le lien ne dit rien de plus qu'« indisponible ».
  const detail = view.access.mode === "none" ? null : await deps.detail(view, share.playlistId);
  if (!detail) return { ok: false, reason: "unavailable" };
  return { ok: true, document: sharedDocumentOf(detail, share.ownerName), share };
}
