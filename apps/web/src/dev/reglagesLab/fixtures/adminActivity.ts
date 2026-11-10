/**
 * L'ACTIVITÉ vue de l'administration : les sessions en direct (`/api/admin/sessions`), les
 * invitations (`/api/invites`) et les tickets de tous les comptes (`/api/tickets/all`).
 *
 * Cinq sessions : Sintel en lecture directe (dans une salle Watch Together), Cosmos Laundromat
 * en transcodage, Big Buck Bunny en pause chez un INVITÉ de la Famille, et deux appareils au
 * repos. Six invitations, des trois statuts (active, expirée, épuisée).
 * Formes : `types/adminSessionsDto.ts`, `invites/` (shared), `useTickets.ts` (api-client).
 */

import type { AdminInviteDto, AdminSessionDto, AdminSessionsSnapshotDto } from "@tentacle-tv/shared";
import type { LabRoute } from "../labFetch";
import { labAgo } from "./accountPairing";
import { labAllTickets } from "./accountTickets";
import type { AdminState } from "./adminServer";
import { record, type LabRequest } from "./settingsShared";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TICKS = 10_000_000;

function session(id: string, userId: string, userName: string, client: string, deviceName: string, more: Partial<AdminSessionDto> = {}): AdminSessionDto {
  return {
    id, userId, userName, userImageTag: null, familyGuestOf: null, client, deviceName, deviceId: `device-${id}`, applicationVersion: "1.42.0",
    remoteAddress: "192.168.1.31", lastActivity: labAgo(0), supportsRemoteControl: true, viaTentacle: true, nowPlaying: null, isPaused: false,
    isMuted: false, positionTicks: 0, positionAt: Date.now(), playMethod: null, source: null, transcoding: null, watchGroupId: null, ...more,
  };
}

const movie = (itemId: string, name: string, productionYear: number, seconds: number) => ({
  itemId, name, type: "Movie", productionYear, runTimeTicks: seconds * TICKS, imageItemId: itemId,
});

function sessions(): AdminSessionDto[] {
  return [
    session("s-lea", "u-lea", "Léa", "Tentacle TV (tvOS)", "Apple TV du salon", {
      applicationVersion: "1.20.0", nowPlaying: movie("it-sintel", "Sintel", 2010, 888), positionTicks: 412 * TICKS, playMethod: "DirectPlay",
      watchGroupId: "wg-sintel",
      source: {
        container: "mkv", videoCodec: "hevc", videoProfile: "Main 10", videoBitDepth: 10, width: 3840, height: 1634, videoRange: "HDR10",
        audioCodec: "eac3", audioChannels: 6, audioLanguage: "eng", subtitle: "Français - SRT", subtitleCodec: "subrip", bitrate: 24_600_000,
      },
    }),
    session("s-malik", "u-malik", "Malik", "Tentacle TV (Web)", "Chrome — Windows", {
      remoteAddress: "203.0.113.77", nowPlaying: movie("it-cosmos", "Cosmos Laundromat", 2015, 730), positionTicks: 95 * TICKS, playMethod: "Transcode",
      source: {
        container: "mkv", videoCodec: "av1", videoProfile: "Main", videoBitDepth: 10, width: 2048, height: 858, videoRange: "SDR",
        audioCodec: "flac", audioChannels: 2, audioLanguage: "eng", bitrate: 9_800_000,
      },
      transcoding: {
        videoCodec: "h264", audioCodec: "aac", container: "ts", isVideoDirect: false, isAudioDirect: false, bitrate: 6_000_000, framerate: 24,
        width: 1920, height: 804, audioChannels: 2, completionPercentage: 38, hardwareAccelerationType: "vaapi",
        reasons: ["VideoCodecNotSupported", "AudioCodecNotSupported"],
      },
    }),
    // Un invité de la Famille : la seule place où il paraît.
    session("s-salon", "g-salon", "Salon", "Tentacle TV (Android TV)", "Shield TV du salon", {
      applicationVersion: "1.20.0", familyGuestOf: "Camille", nowPlaying: movie("it-bunny", "Big Buck Bunny", 2008, 596), positionTicks: 301 * TICKS,
      isPaused: true, playMethod: "DirectStream", lastActivity: labAgo(6 * MINUTE),
      source: {
        container: "mov,mp4,m4a,3gp,3g2,mj2", videoCodec: "h264", videoProfile: "High", videoBitDepth: 8, width: 1920, height: 1080, videoRange: "SDR",
        audioCodec: "ac3", audioChannels: 6, audioLanguage: "eng", bitrate: 8_400_000,
      },
    }),
    session("s-camille", "u-camille", "Camille", "Tentacle TV (Desktop)", "Bureau de Camille", { lastActivity: labAgo(20_000) }),
    session("s-ines", "u-ines", "Inès", "Tentacle TV (iOS)", "iPhone d'Inès", {
      applicationVersion: "1.32.0", remoteAddress: "203.0.113.140", lastActivity: labAgo(14 * MINUTE), supportsRemoteControl: false, viaTentacle: false,
    }),
  ];
}

function snapshot(state: AdminState): AdminSessionsSnapshotDto {
  const now = Date.now();
  if (state === "empty") return { serverTime: now, sessions: [], groups: [] };
  return {
    serverTime: now,
    sessions: sessions(),
    groups: [{
      groupId: "wg-sintel", itemId: "it-sintel", isPaused: false, positionTicks: 412 * TICKS, positionAt: now,
      members: [
        { userId: "u-lea", userName: "Léa", hasAvatar: false, isHost: true, inPlayback: true, buffering: false, driftMs: 40, sessionId: "s-lea" },
        { userId: "u-noe", userName: "Noé", hasAvatar: false, isHost: false, inPlayback: false, buffering: false, driftMs: null, sessionId: null },
      ],
    }],
  };
}

function seedInvites(): AdminInviteDto[] {
  const used = (username: string, agoMs: number, userId: string) => ({ username, usedAt: labAgo(agoMs), jellyfinUserId: userId });
  return [
    // Active, à moitié utilisée.
    {
      id: "inv-famille", key: "LAB-INVITE", maxUses: 5, currentUses: 2, expiresAt: new Date(Date.now() + 12 * DAY).toISOString(), createdAt: labAgo(9 * DAY),
      createdBy: "Camille", usages: [used("Malik", 8 * DAY, "u-malik"), used("Inès", 3 * DAY, "u-ines")],
    },
    // Active, sans échéance, jamais servie.
    { id: "inv-voisins", key: "LABO-VOISINS-0001", maxUses: 1, currentUses: 0, expiresAt: null, createdAt: labAgo(2 * DAY), createdBy: "Noé", usages: [] },
    // Active, qui expire dans quelques heures.
    {
      id: "inv-soiree", key: "LABO-SOIREE-0002", maxUses: 10, currentUses: 1, expiresAt: new Date(Date.now() + 5 * HOUR).toISOString(), createdAt: labAgo(19 * HOUR),
      createdBy: "Camille", usages: [used("Océane", 17 * HOUR, "u-oceane")],
    },
    // Expirée sans avoir servi.
    { id: "inv-ete", key: "LABO-ETE-0003", maxUses: 3, currentUses: 0, expiresAt: labAgo(21 * DAY), createdAt: labAgo(51 * DAY), createdBy: "Camille", usages: [] },
    // Épuisée.
    {
      id: "inv-coloc", key: "LABO-COLOC-0004", maxUses: 2, currentUses: 2, expiresAt: null, createdAt: labAgo(140 * DAY), createdBy: null,
      usages: [used("Léa", 139 * DAY, "u-lea"), used("Hugo", 131 * DAY, "u-hugo")],
    },
    // Épuisée, puis échue.
    {
      id: "inv-noe", key: "LABO-NOE-0005", maxUses: 1, currentUses: 1, expiresAt: labAgo(200 * DAY), createdAt: labAgo(214 * DAY), createdBy: null,
      usages: [used("Noé", 212 * DAY, "u-noe")],
    },
  ];
}

/** Une clé d'invitation de labo, visiblement factice : « LABO-0007 ». */
let created = 5;
const labKey = (): string => {
  created += 1;
  return `LABO-${String(created).padStart(4, "0")}`;
};

export function activityRoutes(state: AdminState): readonly LabRoute[] {
  const invites = state === "empty" ? [] : seedInvites();
  const tickets = () => (state === "empty" ? [] : labAllTickets());

  return [
    { path: "/api/admin/sessions", reply: () => snapshot(state) },
    { method: "POST", path: /^\/api\/admin\/sessions\/[^/]+\/(playstate|message)$/, reply: { ok: true } },
    { method: "POST", path: /^\/api\/admin\/watch-groups\/[^/]+\/(message|stop)$/, reply: { delivered: 1, total: 2 } },

    { path: "/api/invites", reply: () => invites },
    {
      method: "POST", path: "/api/invites",
      reply: ({ body }: LabRequest) => {
        const input = record(body);
        const hours = typeof input.expiresInHours === "number" ? input.expiresInHours : null;
        const made: AdminInviteDto = {
          id: `inv-${Date.now()}`, key: labKey(), maxUses: typeof input.maxUses === "number" ? input.maxUses : 1, currentUses: 0,
          expiresAt: hours === null ? null : new Date(Date.now() + hours * HOUR).toISOString(), createdAt: labAgo(0), createdBy: "Camille", usages: [],
        };
        invites.unshift(made);
        return { id: made.id, key: made.key, maxUses: made.maxUses, expiresAt: made.expiresAt };
      },
    },
    {
      method: "DELETE", path: /^\/api\/invites\/[^/]+$/,
      reply: ({ url }: LabRequest) => {
        const index = invites.findIndex((invite) => invite.id === decodeURIComponent(url.pathname.split("/")[3] ?? ""));
        if (index >= 0) invites.splice(index, 1);
        return { success: true };
      },
    },

    {
      path: "/api/tickets/all",
      reply: ({ url }: LabRequest) => {
        const status = url.searchParams.get("status");
        const limit = Math.max(1, Number(url.searchParams.get("limit")) || 20);
        const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
        const all = tickets().filter((ticket) => !status || ticket.status === status).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return { results: all.slice((page - 1) * limit, page * limit), total: all.length, page, totalPages: Math.max(1, Math.ceil(all.length / limit)) };
      },
    },
  ];
}
