import type { WtMemberDto, WtRoomStateDto } from "../../types/watchTogether";

/**
 * Watch Together — ce que montre la feuille du groupe sur le mobile et
 * l'iPad, en module PUR (testé sans React Native) : l'ordre des membres,
 * l'état de chacun DIT EN MOTS (jamais la couleur seule), qui peut expulser.
 * Mêmes règles que les lignes du web (`RoomMemberRow`, `memberStatus`).
 */

/** L'état d'un membre : la pastille ET la clé i18n (`watchTogether`) qui le dit. */
export type WtMemberState = "error" | "buffering" | "watching" | "online" | "offline";

export const MEMBER_STATE_LABEL: Record<WtMemberState, string> = {
  error: "cantPlay",
  buffering: "bufferingStatus",
  watching: "watching",
  online: "online",
  offline: "offline",
};

export function memberState(member: WtMemberDto): WtMemberState {
  if (!member.online) return "offline";
  if (member.playbackError) return "error";
  if (member.buffering) return "buffering";
  if (member.inPlayback) return "watching";
  return "online";
}

export interface WtMemberRowModel {
  member: WtMemberDto;
  isSelf: boolean;
  state: WtMemberState;
  canKick: boolean;
}

/**
 * L'hôte d'abord, puis soi, puis les autres par ordre d'arrivée : la liste
 * ne bouge pas quand un état change (aucune ligne ne saute sous le doigt).
 */
export function roomMemberRows(room: WtRoomStateDto, selfId: string | null): WtMemberRowModel[] {
  const selfIsHost = !!selfId && room.hostUserId === selfId;
  const rank = (m: WtMemberDto): number => (m.isHost ? 0 : m.userId === selfId ? 1 : 2);
  return [...room.members]
    .sort((a, b) => rank(a) - rank(b) || a.joinedAt - b.joinedAt)
    .map((member) => {
      const isSelf = member.userId === selfId;
      return { member, isSelf, state: memberState(member), canKick: selfIsHost && !isSelf };
    });
}

/**
 * Les AUTRES membres que la salle attend (mon propre chargement a déjà son
 * indicateur) — règle de `GroupPlaybackOverlay` (web).
 */
export function waitingOthers(room: WtRoomStateDto, selfId: string | null): WtMemberDto[] {
  return room.waitingForUserIds
    .filter((id) => id !== selfId)
    .map((id) => room.members.find((m) => m.userId === id))
    .filter((m): m is WtMemberDto => !!m);
}

/**
 * Le voile d'attente du lecteur : une clé `watchTogether` et ses paramètres,
 * ou rien. Toute attente d'autres lecteurs se montre, même en pause : une
 * barrière (saut, reprise, passage) dit « Synchronisation… », un chargement
 * nomme qui charge. Un serveur d'avant n'envoie pas `waitCause` : chargement.
 */
export function waitingNotice(room: WtRoomStateDto | null, selfId: string | null):
  { key: string; params?: Record<string, string | number> } | null {
  if (!room || !room.paused) return null;
  const others = waitingOthers(room, selfId);
  if (others.length === 0) return null;
  if (room.waitCause !== undefined && room.waitCause !== "buffering") return { key: "syncing" };
  if (others.length === 1) return { key: "memberBuffering", params: { name: others[0]!.username } };
  return { key: "membersBuffering", params: { count: others.length } };
}
