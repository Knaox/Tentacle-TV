/**
 * Octave — QUI peut quoi sur une playlist (capacité `music.playlistMembers`) : le propriétaire (`CanDelete` vu
 * par lui, la règle d'avant), un MEMBRE à qui il l'a partagée (droit tenu par Tentacle), ou un compte qui la
 * voit sans droit (une playlist publique de Jellyfin : lecture seule).
 *
 * Jellyfin refuse ses propres partages à la clé d'API et ne sait pas « ajouter sans retirer » : un membre lit
 * et écrit la playlist AU NOM DU PROPRIÉTAIRE (`readerId`), après le contrôle de son droit ici — jamais avant,
 * jamais par le client.
 */

import { isCapabilityDeclared } from "../../serverCapabilities/declaredCapabilities";
import { memberRightAllows, type MusicPlaylistMemberRight } from "../contract/musicPlaylistMembers";
import { playlistFor, type JfPlaylist } from "../playlists/playlistJellyfin";
import { idOf, membershipOf, membersOf } from "./memberStore";

export type PlaylistGesture = "read" | "add" | "remove" | "manage";

export interface PlaylistAccess {
  /** La playlist lue au nom de `readerId`. */
  playlist: JfPlaylist;
  /** Le compte au nom duquel Jellyfin est lu et écrit : le sien, ou celui du propriétaire pour un membre. */
  readerId: string;
  /** `owner`, le droit du membre, ou `null` : visible sans droit (playlist publique). */
  right: MusicPlaylistMemberRight | "owner" | null;
}

export function membersEnabled(): boolean {
  return isCapabilityDeclared("music.playlistMembers");
}

/** L'accès de ce compte à cette playlist ; `null` s'il ne la voit pas (rien ne trahit son existence). */
export async function playlistAccess(userId: string, playlistId: string): Promise<PlaylistAccess | null> {
  const own = await playlistFor(userId, playlistId);
  if (own?.CanDelete === true) return { playlist: own, readerId: idOf(userId), right: "owner" };
  if (membersEnabled()) {
    const membership = await membershipOf(playlistId, userId).catch(() => null);
    if (membership) {
      // Le propriétaire l'est-il encore ? (Une playlist donnée à un autre dans Jellyfin ne garde pas ses membres.)
      const viaOwner = await playlistFor(membership.ownerUserId, playlistId);
      if (viaOwner?.CanDelete === true) return { playlist: { ...viaOwner, TentacleReaderId: membership.ownerUserId }, readerId: membership.ownerUserId, right: membership.right };
    }
  }
  return own ? { playlist: own, readerId: idOf(userId), right: null } : null;
}

/** Le droit permet-il ce geste ? `manage` (renommer, décrire, supprimer, partager, ordre de Jellyfin) : le propriétaire. */
export function accessAllows(right: PlaylistAccess["right"], gesture: PlaylistGesture): boolean {
  if (gesture === "read") return true;
  if (right === null) return false;
  if (gesture === "manage") return right === "owner";
  return memberRightAllows(right, gesture);
}

/** La playlist a-t-elle au moins un membre ? Son ordre est alors à chacun : Jellyfin ne se réordonne plus. */
export async function isShared(playlistId: string): Promise<boolean> {
  if (!membersEnabled()) return false;
  return (await membersOf(playlistId).catch(() => [])).length > 0;
}

/** Le compte au nom duquel lire une playlist que la liste ou la vue a obtenue (`playlistAccess`). */
export function readerOf(userId: string, playlist: JfPlaylist): string {
  return playlist.TentacleReaderId ?? userId;
}
