/**
 * Octave — une playlist PARTAGÉE entre comptes du même serveur (capacité `music.playlistMembers`, 1.40.0).
 * Contrat commun au cœur et aux clients, recopié octet pour octet dans le backend
 * (`apps/backend/src/music/contract/`, test miroir). Pur.
 *
 * - Le propriétaire donne à N'IMPORTE QUEL compte du serveur (jamais un invité de la Famille) un droit :
 *   `read` (lire), `add` (lire et ajouter), `remove` (lire, ajouter et retirer). Le SERVEUR le fait respecter.
 * - Renommer, décrire, supprimer, partager restent au propriétaire (`editable`, comme avant).
 * - L'ORDRE est à chacun (préférence du compte, `musicListOrder.ts`) : une playlist partagée n'est jamais
 *   réordonnée dans Jellyfin, et un titre ajouté par quiconque entre à la FIN de l'ordre de chacun.
 * - Sans rapport avec `music.playlistShare` (le lien public lu par un AUTRE serveur) : les deux coexistent.
 */

export type MusicPlaylistMemberRight = "read" | "add" | "remove";

/** Du plus faible au plus fort : chaque droit contient les précédents. */
export const MUSIC_PLAYLIST_MEMBER_RIGHTS: readonly MusicPlaylistMemberRight[] = ["read", "add", "remove"];

/** Au-delà, le partage est refusé (400 `too_many_members`). */
export const MUSIC_PLAYLIST_MEMBERS_MAX = 50;

export const MUSIC_PLAYLIST_MEMBER_ROUTES = {
  /** GET → `MusicPlaylistSharing` (propriétaire ou membre) ; PUT { userId, right } → ajoute ou change (propriétaire). */
  members: "/api/music/playlists/:id/members",
  /** DELETE → retire ce membre (propriétaire) ; PATCH { right } → change son droit (propriétaire). */
  member: "/api/music/playlists/:id/members/:userId",
  /** DELETE → QUITTER la playlist (un membre, pour lui-même). */
  membership: "/api/music/playlists/:id/membership",
  /** GET → `MusicPlaylistPerson[]` : les comptes à qui partager (ni soi, ni invité, ni compte désactivé). */
  candidates: "/api/music/playlist-members/candidates",
} as const;

/** Un compte tel qu'on le montre : nom et photo (Jellyfin), rien d'autre. */
export interface MusicPlaylistPerson {
  userId: string;
  name: string;
  /** `PrimaryImageTag` de Jellyfin ; `null` : pas de photo (l'initiale). */
  imageTag: string | null;
}

export interface MusicPlaylistMember extends MusicPlaylistPerson {
  right: MusicPlaylistMemberRight;
}

/** Le partage d'une playlist, vu par le compte qui la lit. Absent de `MusicPlaylist` : elle n'est pas partagée. */
export interface MusicPlaylistSharing {
  role: "owner" | "member";
  /** Le droit du compte qui lit : `owner` pour le propriétaire. */
  right: MusicPlaylistMemberRight | "owner";
  owner: MusicPlaylistPerson;
  /** Les membres, dans l'ordre où ils ont été ajoutés (le compte qui lit compris s'il en est un). */
  members: MusicPlaylistMember[];
}

export function parseMemberRight(value: unknown): MusicPlaylistMemberRight | null {
  return typeof value === "string" && (MUSIC_PLAYLIST_MEMBER_RIGHTS as readonly string[]).includes(value) ? (value as MusicPlaylistMemberRight) : null;
}

type Gesture = "add" | "remove";

/** Ce droit permet-il ce geste ? Le propriétaire peut tout. */
export function memberRightAllows(right: MusicPlaylistMemberRight | "owner", gesture: Gesture): boolean {
  if (right === "owner") return true;
  return MUSIC_PLAYLIST_MEMBER_RIGHTS.indexOf(right) >= MUSIC_PLAYLIST_MEMBER_RIGHTS.indexOf(gesture);
}

interface PlaylistRights {
  editable: boolean;
  sharing?: MusicPlaylistSharing | null;
}

/** Le compte peut-il AJOUTER à cette playlist (la sienne, ou partagée avec « ajouter ») ? */
export function canAddToPlaylist(playlist: PlaylistRights): boolean {
  return playlist.editable || (!!playlist.sharing && memberRightAllows(playlist.sharing.right, "add"));
}

/** Le compte peut-il RETIRER un titre de cette playlist ? */
export function canRemoveFromPlaylist(playlist: PlaylistRights): boolean {
  return playlist.editable || (!!playlist.sharing && memberRightAllows(playlist.sharing.right, "remove"));
}

/** Partagée : au moins un membre (le propriétaire la voit ainsi), ou le compte en est membre. */
export function isSharedPlaylist(playlist: PlaylistRights): boolean {
  return !!playlist.sharing && (playlist.sharing.role === "member" || playlist.sharing.members.length > 0);
}

/** Les personnes qui ont accès, propriétaire en tête (la pile d'avatars), sans le compte qui lit. */
export function playlistPeople(sharing: MusicPlaylistSharing, readerId: string): MusicPlaylistPerson[] {
  const reader = readerId.replace(/-/g, "").toLowerCase();
  const people = [sharing.owner, ...sharing.members];
  const seen = new Set<string>();
  return people.filter((p) => {
    const id = p.userId.replace(/-/g, "").toLowerCase();
    if (id === reader || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
