/**
 * La musique gardée sur le mobile : le compte de l'appareil, la base ouverte
 * seulement au premier abonnement, le fichier gardé remis au lecteur
 * (`kept.localUri`), et la file hors ligne faite des seuls titres gardés.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";

const h = vi.hoisted(() => ({ listed: 0, offline: false, tracks: [] as KeptMusicTrack[], fileUri: "file:///doc/offline/media/a/audio-original.flac" as string | null }));

vi.mock("../../offline/engineRuntime", () => ({ subscribeOfflineChanged: () => () => undefined, subscribeOfflineProgress: () => () => undefined }));
vi.mock("../../offline/engineMusicApi", () => ({
  listKeptMusic: () => {
    h.listed += 1;
    return { tracks: h.tracks, collections: [] };
  },
  keepMusicOffline: () => ({ accepted: true, neededBytes: 0 }),
  removeKeptMusic: async () => undefined,
  saveKeptMusicCollections: () => undefined,
  keptMusicFileUri: () => h.fileUri,
  keptMusicResourceUri: (rel: string) => `file:///doc/offline/${rel}`,
}));
vi.mock("../../offline/connectivityStore", () => ({ isOfflineMode: () => h.offline }));
vi.mock("../../offline/useOfflineMode", () => ({ useOfflineMode: () => h.offline }));
vi.mock("@tentacle-tv/api-client", () => ({ tentacleApiFetch: async () => ({ tracks: [], refused: [] }) }));

import { configureMusicOffline, keptMusicStore, subscribeKeptMusic } from "./keptMusic";
import { keptPlaybackSource, playableUri } from "./keptPlayback";
import { offlinePlayableQueue } from "./useOfflineMusic";

function kept(key: string, partial: Partial<KeptMusicTrack> = {}): KeptMusicTrack {
  return {
    fileId: 1, itemId: key.slice(3), trackKey: key, origin: "library", variant: "original", preset: null, status: "complete", errorCode: null,
    pausedByUser: false, bytesDone: 10, expectedSize: 10, title: key, artist: null, album: null, albumKey: null, discNumber: null,
    trackNumber: null, durationMs: 1000, coverRel: null, sourcePath: null, trackJson: "{}", createdAt: 0, ...partial,
  };
}

const ACCOUNT = { getItem: (key: string) => (key === "tentacle_user" ? JSON.stringify({ Id: "compte" }) : key === "tentacle_token" ? "jeton" : null) };

describe("musique gardée (mobile)", () => {
  beforeEach(() => {
    h.tracks = [kept("jf:a"), kept("jf:b", { status: "downloading" })];
  });

  it("la base ne s'ouvre qu'au premier abonnement, même s'il précède le stockage", async () => {
    expect(h.listed).toBe(0);
    const off = subscribeKeptMusic(() => undefined);
    expect(h.listed).toBe(0);
    configureMusicOffline(ACCOUNT);
    await keptMusicStore.refresh();
    expect(h.listed).toBeGreaterThan(0);
    off();
  });

  it("le lecteur reçoit le fichier gardé ; sans fichier, rien (le serveur reprend)", async () => {
    configureMusicOffline(ACCOUNT);
    await keptMusicStore.refresh();
    const source = keptPlaybackSource("jf:a");
    expect(source && playableUri(source)).toBe(h.fileUri);
    expect(keptPlaybackSource("jf:b")).toBeNull();
    h.fileUri = null;
    expect(keptPlaybackSource("jf:a")).toBeNull();
    h.fileUri = "file:///doc/offline/media/a/audio-original.flac";
  });

  it("hors ligne, la file ne garde que les titres complets", async () => {
    configureMusicOffline(ACCOUNT);
    await keptMusicStore.refresh();
    const tracks = ["jf:a", "jf:b"].map((key) => ({ key }) as never);
    h.offline = true;
    const queue = offlinePlayableQueue(tracks, 1);
    h.offline = false;
    expect(queue?.tracks.map((t: { key: string }) => t.key)).toEqual(["jf:a"]);
  });
});
