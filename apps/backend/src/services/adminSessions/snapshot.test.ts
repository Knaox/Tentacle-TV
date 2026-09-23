import { describe, expect, it } from "vitest";
import type { ConnectionView } from "../deviceSessions/registry";
import type { Room, RoomMember } from "../watchTogether/roomTypes";
import { toAdminSession } from "./mapSession";
import { buildSnapshot, IDLE_WINDOW_MS } from "./snapshot";

/**
 * L'instantané du tableau de bord : une session Jellyfin réduite à l'utile,
 * la position à la seconde d'une lecture Tentacle, et les salles Watch
 * Together reliées aux sessions de leurs membres.
 */

const NOW = Date.parse("2026-09-23T20:00:00Z");

function rawSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: "s1",
    UserId: "u1",
    UserName: "Alice",
    Client: "Tentacle TV - Web",
    DeviceName: "Chrome",
    DeviceId: "dev1",
    ApplicationVersion: "1.21.5",
    LastActivityDate: new Date(NOW - 5_000).toISOString(),
    LastPlaybackCheckIn: new Date(NOW - 60_000).toISOString(),
    SupportsRemoteControl: true,
    NowPlayingItem: {
      Id: "ep1", Name: "Pilote", Type: "Episode", SeriesName: "Série", SeriesId: "ser1",
      SeriesPrimaryImageTag: "tag-serie", ParentIndexNumber: 1, IndexNumber: 2, RunTimeTicks: 2_400 * 10_000_000,
      MediaStreams: [
        { Type: "Video", Index: 0, Codec: "hevc", Width: 3840, Height: 2160, VideoRangeType: "DOVI", BitRate: 40_000_000 },
        { Type: "Audio", Index: 1, Codec: "eac3", Channels: 6, Language: "fre" },
        { Type: "Audio", Index: 2, Codec: "aac", Channels: 2, Language: "eng" },
        { Type: "Subtitle", Index: 3, DisplayTitle: "Français - SRT" },
      ],
    },
    PlayState: { PositionTicks: 600 * 10_000_000, IsPaused: false, AudioStreamIndex: 2, SubtitleStreamIndex: 3, PlayMethod: "Transcode" },
    TranscodingInfo: {
      VideoCodec: "h264", AudioCodec: "aac", Container: "ts", IsVideoDirect: false, IsAudioDirect: true,
      Bitrate: 8_000_000, Width: 1920, Height: 1080, HardwareAccelerationType: "videotoolbox",
      TranscodeReasons: ["VideoCodecNotSupported", "VideoRangeTypeNotSupported"],
    },
    ...overrides,
  };
}

function member(userId: string, username: string): RoomMember {
  return {
    userId, username, hasAvatar: false, inPlayback: true, buffering: false, playbackError: false, joinedAt: 0,
    graceTimer: null, protocolVersion: 2, rttMs: null, driftMs: 40, playbackSocket: null,
  };
}

function room(members: RoomMember[]): Room {
  return {
    groupId: "g1", hostUserId: "u1", itemId: "ep1", paused: false,
    positionTicks: 100 * 10_000_000, stateAtServerTime: NOW - 2_000,
    members: new Map(members.map((m) => [m.userId, m])),
  } as unknown as Room;
}

describe("toAdminSession", () => {
  it("ne garde que l'utile : lecture, pistes choisies, transcodage et ses raisons", () => {
    const s = toAdminSession(rawSession() as never, NOW);
    expect(s).toMatchObject({
      id: "s1", userName: "Alice", client: "Tentacle TV - Web", supportsRemoteControl: true, viaTentacle: false,
      playMethod: "Transcode", positionTicks: 600 * 10_000_000, positionAt: NOW - 60_000,
      nowPlaying: { itemId: "ep1", seriesName: "Série", seasonNumber: 1, episodeNumber: 2, imageItemId: "ser1", imageTag: "tag-serie" },
      source: { videoCodec: "hevc", videoRange: "DOVI", audioCodec: "aac", audioChannels: 2, audioLanguage: "eng", subtitle: "Français - SRT" },
      transcoding: { videoCodec: "h264", isVideoDirect: false, isAudioDirect: true, hardwareAccelerationType: "videotoolbox" },
    });
    expect(s?.transcoding?.reasons).toEqual(["VideoCodecNotSupported", "VideoRangeTypeNotSupported"]);
  });

  it("une session sans compte (clé d'API, tâche de fond) n'a rien à faire au tableau de bord", () => {
    expect(toAdminSession(rawSession({ UserId: undefined }) as never, NOW)).toBeNull();
  });

  it("sans lecture : ni méthode, ni source, ni transcodage", () => {
    const s = toAdminSession(rawSession({ NowPlayingItem: null }) as never, NOW);
    expect(s).toMatchObject({ nowPlaying: null, playMethod: null, source: null, transcoding: null });
  });
});

describe("buildSnapshot", () => {
  const base = { receivedAt: NOW, connections: [] as ConnectionView[], rooms: [] as Room[], now: NOW };

  it("une session au repos disparaît après dix minutes sans activité ; une lecture, jamais", () => {
    const stale = new Date(NOW - IDLE_WINDOW_MS - 1_000).toISOString();
    const snap = buildSnapshot({
      ...base,
      raw: [
        rawSession({ Id: "idle", NowPlayingItem: null, LastActivityDate: stale }),
        rawSession({ Id: "playing", LastActivityDate: stale }),
      ],
    });
    expect(snap.sessions.map((s) => s.id)).toEqual(["playing"]);
  });

  it("une lecture Tentacle prend la position à la seconde du canal", () => {
    const snap = buildSnapshot({
      ...base,
      raw: [rawSession()],
      connections: [{
        userId: "u1", username: "Alice", deviceId: "dev1", remoteControl: true, connectedAt: 0,
        playback: { itemId: "ep1", playMethod: "Transcode", positionTicks: 642 * 10_000_000, isPaused: true },
      }],
    });
    expect(snap.sessions[0]).toMatchObject({ viaTentacle: true, positionTicks: 642 * 10_000_000, positionAt: NOW, isPaused: true });
  });

  it("deux onglets d'un même appareil : la position vient de celui qui lit", () => {
    const view = (playback: ConnectionView["playback"]): ConnectionView => ({
      userId: "u1", username: "Alice", deviceId: "dev1", remoteControl: true, connectedAt: 0, playback,
    });
    const snap = buildSnapshot({
      ...base,
      raw: [rawSession()],
      connections: [view(null), view({ itemId: "ep1", playMethod: "Transcode", positionTicks: 700 * 10_000_000, isPaused: false })],
    });
    expect(snap.sessions[0]).toMatchObject({ viaTentacle: true, positionTicks: 700 * 10_000_000, positionAt: NOW });
  });

  it("une salle se relie aux sessions de ses membres, position extrapolée", () => {
    const snap = buildSnapshot({
      ...base,
      raw: [rawSession(), rawSession({ Id: "s2", UserId: "u2", UserName: "Bob", DeviceId: "dev2" })],
      rooms: [room([member("u1", "Alice"), member("u2", "Bob"), member("u3", "Chloé")])],
    });
    const group = snap.groups[0];
    expect(group?.positionTicks).toBe(102 * 10_000_000);
    expect(group?.members.map((m) => [m.userName, m.isHost, m.sessionId])).toEqual([
      ["Alice", true, "s1"], ["Bob", false, "s2"], ["Chloé", false, null],
    ]);
    expect(snap.sessions.every((s) => s.watchGroupId === "g1")).toBe(true);
  });

  it("les lectures d'abord, puis les sessions au repos, la plus récente en tête", () => {
    const snap = buildSnapshot({
      ...base,
      raw: [
        rawSession({ Id: "old", NowPlayingItem: null, LastActivityDate: new Date(NOW - 60_000).toISOString() }),
        rawSession({ Id: "zoe", UserName: "Zoé" }),
        rawSession({ Id: "recent", NowPlayingItem: null, LastActivityDate: new Date(NOW - 1_000).toISOString() }),
        rawSession({ Id: "anna", UserName: "Anna" }),
      ],
    });
    expect(snap.sessions.map((s) => s.id)).toEqual(["anna", "zoe", "recent", "old"]);
  });
});
