import type { ConnectionView } from "../deviceSessions/registry";
import { wtPositionTicksAt } from "../watchTogether/protocolMessages";
import type { Room } from "../watchTogether/roomTypes";
import type { AdminSessionDto, AdminSessionsSnapshotDto, AdminWatchGroupDto } from "./dto";
import { toAdminSession, type RawSession } from "./mapSession";

/**
 * L'instantané du tableau de bord : les sessions de Jellyfin, éclairées par
 * ce que Tentacle sait mieux que lui, et les salles Watch Together.
 *
 * - Une lecture portée par le canal de session a sa position À LA SECONDE —
 *   Jellyfin, lui, ne la reçoit qu'aux bords et toutes les quatre minutes.
 * - Une salle se relie aux sessions de ses membres par (compte, média lu).
 *
 * Fonction pure : le tableau de bord se teste sans Jellyfin ni socket.
 */

/** Une session sans lecture reste affichée tant qu'elle a servi dans ce délai. */
export const IDLE_WINDOW_MS = 10 * 60_000;

export interface SnapshotInput {
  raw: readonly unknown[];
  /** Quand la liste de Jellyfin a été reçue. */
  receivedAt: number;
  connections: readonly ConnectionView[];
  rooms: Iterable<Room>;
  now: number;
}

function overlayTentacle(session: AdminSessionDto, connections: readonly ConnectionView[], now: number): void {
  const connection = connections.find((c) => c.userId === session.userId && c.deviceId === session.deviceId);
  if (!connection) return;
  session.viaTentacle = true;
  const playback = connection.playback;
  if (playback && session.nowPlaying && playback.itemId === session.nowPlaying.itemId) {
    session.positionTicks = playback.positionTicks;
    session.positionAt = now;
    session.isPaused = playback.isPaused;
  }
}

/** Lectures d'abord (par compte), puis les sessions au repos, la plus récente en tête. */
function compare(a: AdminSessionDto, b: AdminSessionDto): number {
  const playingA = a.nowPlaying !== null;
  const playingB = b.nowPlaying !== null;
  if (playingA !== playingB) return playingA ? -1 : 1;
  if (playingA) return a.userName.localeCompare(b.userName) || a.id.localeCompare(b.id);
  return Date.parse(b.lastActivity) - Date.parse(a.lastActivity);
}

export function buildSnapshot(input: SnapshotInput): AdminSessionsSnapshotDto {
  const sessions: AdminSessionDto[] = [];
  for (const raw of input.raw) {
    if (raw === null || typeof raw !== "object") continue;
    const session = toAdminSession(raw as RawSession, input.receivedAt);
    if (session === null) continue;
    if (session.nowPlaying === null && input.now - Date.parse(session.lastActivity) > IDLE_WINDOW_MS) continue;
    overlayTentacle(session, input.connections, input.now);
    sessions.push(session);
  }

  const groups: AdminWatchGroupDto[] = [];
  for (const room of input.rooms) {
    const members = [...room.members.values()].map((member) => {
      const session = room.itemId === null
        ? undefined
        : sessions.find((s) => s.userId === member.userId && s.nowPlaying?.itemId === room.itemId);
      if (session) session.watchGroupId = room.groupId;
      return {
        userId: member.userId,
        userName: member.username,
        hasAvatar: member.hasAvatar,
        isHost: member.userId === room.hostUserId,
        inPlayback: member.inPlayback,
        buffering: member.buffering,
        driftMs: member.driftMs,
        sessionId: session?.id ?? null,
      };
    });
    groups.push({
      groupId: room.groupId,
      itemId: room.itemId,
      isPaused: room.paused,
      positionTicks: Math.floor(wtPositionTicksAt(room, input.now)),
      positionAt: input.now,
      members,
    });
  }

  sessions.sort(compare);
  return { serverTime: input.now, sessions, groups };
}
