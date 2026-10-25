import { describe, expect, it } from "vitest";
import type { DeclaredSessionInput } from "./declaredSessions";
import { toAdminSession } from "./mapSession";
import { buildSnapshot } from "./snapshot";

/**
 * Les écoutes dans le tableau de bord : un titre de musique tel que Jellyfin le
 * rapporte (pochette de l'album, artistes, album), la position déclarée par
 * Octave, et la lecture d'EXTENSION que Jellyfin ne connaît pas.
 */

const NOW = Date.parse("2026-10-25T21:00:00Z");

function audioSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Id: "s1", UserId: "u1", UserName: "Alice", Client: "Tentacle TV - Web", DeviceName: "Web", DeviceId: "dev1",
    ApplicationVersion: "1.32.0", RemoteEndPoint: "192.168.1.20", UserPrimaryImageTag: "avatar",
    LastActivityDate: new Date(NOW - 5_000).toISOString(), LastPlaybackCheckIn: new Date(NOW - 10_000).toISOString(),
    SupportsRemoteControl: true,
    NowPlayingItem: {
      Id: "track1", Name: "Mouvement 1", Type: "Audio", ParentIndexNumber: 1, IndexNumber: 3, RunTimeTicks: 120 * 10_000_000,
      Artists: ["Banc Octave", "Invité"], AlbumArtist: "Banc Octave", Album: "Enchaînement continu",
      AlbumId: "album1", AlbumPrimaryImageTag: "tag-album", ImageTags: {},
      Container: "flac", MediaStreams: [{ Type: "Audio", Index: 0, Codec: "flac", Channels: 2 }],
    },
    PlayState: { PositionTicks: 0, IsPaused: false, PlayMethod: "DirectPlay" },
    ...overrides,
  };
}

function declared(overrides: Omit<Partial<DeclaredSessionInput>, "state"> & { state?: Partial<DeclaredSessionInput["state"]> } = {}): DeclaredSessionInput {
  const { state, ...rest } = overrides;
  return {
    id: "ext-0123456789abcdef01234567", userId: "u1", username: "alice", deviceId: "dev1", at: NOW - 1_000,
    state: { key: "ext:x:1", title: "Hors bibliothèque", artists: "Artiste", album: "Album", imageUrl: "/api/plugins/x/art/1", durationMs: 180_000, positionMs: 30_000, isPaused: false, ...state },
    ...rest,
  };
}

const base = { receivedAt: NOW, connections: [], rooms: [], now: NOW };

describe("un titre de musique rapporté par Jellyfin", () => {
  it("la pochette est celle de l'album, avec artistes et album ; ni saison ni épisode", () => {
    const item = toAdminSession(audioSession(), NOW)?.nowPlaying;
    expect(item).toMatchObject({
      type: "Audio", imageItemId: "album1", imageTag: "tag-album", artists: "Banc Octave, Invité", album: "Enchaînement continu",
    });
    expect(item?.seasonNumber).toBeUndefined();
    expect(item?.episodeNumber).toBeUndefined();
  });

  it("sa propre pochette passe avant celle de l'album ; sans artistes, l'artiste de l'album", () => {
    const raw = audioSession();
    const own = { ...(raw.NowPlayingItem as object), ImageTags: { Primary: "tag-propre" }, Artists: [] };
    expect(toAdminSession({ ...raw, NowPlayingItem: own }, NOW)?.nowPlaying).toMatchObject({ imageItemId: "track1", imageTag: "tag-propre", artists: "Banc Octave" });
  });

  it("la session de la clé d'API (GUID vide) n'a rien à faire au tableau de bord", () => {
    expect(toAdminSession(audioSession({ UserId: "00000000000000000000000000000000", NowPlayingItem: null }), NOW)).toBeNull();
  });
});

describe("l'écoute déclarée par Octave", () => {
  it("titre de la bibliothèque : la position et la pause déclarées font foi", () => {
    const snap = buildSnapshot({ ...base, raw: [audioSession()], declared: [declared({ state: { itemId: "track1", isPaused: true, positionMs: 42_000 } })] });
    expect(snap.sessions).toHaveLength(1);
    expect(snap.sessions[0]).toMatchObject({ id: "s1", viaTentacle: true, isPaused: true, positionTicks: 42_000 * 10_000, positionAt: NOW - 1_000 });
  });

  it("un autre appareil du même compte n'emprunte pas la déclaration", () => {
    const snap = buildSnapshot({ ...base, raw: [audioSession()], declared: [declared({ deviceId: "dev2", state: { itemId: "track1", isPaused: true } })] });
    expect(snap.sessions[0]?.isPaused).toBe(false);
  });

  it("lecture d'extension : une session à elle, commandable, sur l'appareil de la connexion — qui, au repos, lui cède sa ligne", () => {
    const idle = audioSession({ NowPlayingItem: null, PlayState: {} });
    const snap = buildSnapshot({ ...base, raw: [idle], declared: [declared()] });
    expect(snap.sessions).toHaveLength(1);
    const s = snap.sessions[0]!;
    expect(s).toMatchObject({
      id: "ext-0123456789abcdef01234567", userName: "Alice", userImageTag: "avatar", client: "Tentacle TV - Web", deviceName: "Web",
      remoteAddress: "192.168.1.20", supportsRemoteControl: true, viaTentacle: true, isPaused: false,
      positionTicks: 30_000 * 10_000, positionAt: NOW - 1_000, playMethod: null, source: null, transcoding: null,
    });
    expect(s.nowPlaying).toMatchObject({
      name: "Hors bibliothèque", type: "Audio", artists: "Artiste", album: "Album", imageUrl: "/api/plugins/x/art/1",
      imageItemId: "", runTimeTicks: 180_000 * 10_000, fromExtension: true,
    });
  });

  it("sans session Jellyfin pour l'appareil, la lecture d'extension paraît quand même, au nom de la connexion", () => {
    const snap = buildSnapshot({ ...base, raw: [], declared: [declared({ deviceId: undefined })] });
    expect(snap.sessions[0]).toMatchObject({ userName: "alice", deviceName: "", nowPlaying: { fromExtension: true } });
  });

  it("un invité de la Famille y reste étiqueté", () => {
    const snap = buildSnapshot({ ...base, raw: [], declared: [declared({ deviceId: undefined })], familyGuests: new Map([["u1", "Bob"]]) });
    expect(snap.sessions[0]?.familyGuestOf).toBe("Bob");
  });
});
