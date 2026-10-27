/**
 * Une identité qui change ne perd pas la copie gardée (relevé du 27/10 : `ext:sillon:imp:5ce21388…`, gardé avec la
 * playlist, montré depuis sous `ext:sillon:ytm:t:7svMLLxcJYE`) : le magasin mène la clé d'aujourd'hui à la copie
 * d'hier — marque, « titres qui manquent », lecture depuis le disque.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import type { MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";

const h = vi.hoisted(() => ({ tracks: [] as unknown[] }));
vi.mock("../../../desktop/bridge", () => ({
  invoke: async () => ({ tracks: h.tracks, collections: [] }),
  listen: async () => () => undefined,
}));
vi.mock("../../../desktop/capabilities", () => ({ supportsMusicOffline: () => true }));
vi.mock("../../../offline/offlineOwner", () => ({ readOfflineOwner: () => ({ userId: "compte", token: "jeton" }) }));

import { completeKeptTrack, keptMusicState, refreshKeptMusic, setKeptRenames } from "./keptMusicStore";
import { renamesOf, shownToFormer } from "./keptRenames";
import { keptFor } from "./keptSources";

const OLD = "imp:5ce21388-9a8a-568e-8c8f-cd87ff2538c7";
const NOW = "ytm:t:7svMLLxcJYE";
const track = (id: string): MusicTrack => ({
  key: `ext:sillon:${id}`, jellyfinId: null, external: { pluginId: "sillon", id }, title: "L'assasymphonie", artists: [], album: null,
  durationMs: 231_000, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
  mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "remote", format: null, favorite: false,
});
const item = (id: string, formerIds?: string[]): PendingMusicItem => ({
  operationId: `op-${id}`, externalId: id, kind: "playlistAdd", playlistId: "016730ba00b940ebb413bce5cc7ee158", position: 3, track: track(id),
  state: "pending", createdAt: 0, imported: true, ...(formerIds ? { formerIds } : {}),
});
const keptCopy = (key: string, status: KeptMusicTrack["status"] = "complete"): KeptMusicTrack => ({
  fileId: 119, itemId: "ext-8c89e8680fc3dc627a19891cce6d770a", trackKey: key, origin: "external", variant: "original", preset: null, status,
  errorCode: null, pausedByUser: false, bytesDone: 5, expectedSize: 5, title: "L'assasymphonie", artist: null, album: null, albumKey: null,
  discNumber: null, trackNumber: null, durationMs: 230_973, coverRel: null, sourcePath: `/api/plugins/sillon/music/offline/${encodeURIComponent(OLD)}`,
  trackJson: "{}", createdAt: 0,
});

describe("le magasin — la clé d'aujourd'hui mène à la copie d'hier", () => {
  beforeEach(async () => {
    setKeptRenames(new Map());
    h.tracks = [keptCopy(`ext:sillon:${OLD}`)];
    await refreshKeptMusic();
  });

  it("sans l'identité d'hier : la rangée d'aujourd'hui semble non gardée (ce que Damien voyait)", () => {
    expect(keptMusicState().byKey.has(`ext:sillon:${NOW}`)).toBe(false);
    expect(keptFor(`ext:sillon:${NOW}`)).toBeNull();
  });

  it("avec elle : marquée gardée, et lue depuis le disque sous la clé de la copie", () => {
    setKeptRenames(shownToFormer(renamesOf([item(NOW, [OLD])])));
    expect(completeKeptTrack(`ext:sillon:${NOW}`)?.fileId).toBe(119);
    // La coquille cherche le fichier sous la clé de la COPIE (`kept.trackKey` côté pont).
    expect(keptFor(`ext:sillon:${NOW}`)).toMatchObject({ trackKey: `ext:sillon:${OLD}`, kept: { userId: "compte" } });
  });

  it("une copie gardée sous la clé d'aujourd'hui l'emporte ; une copie d'hier annulée ne compte pas", async () => {
    const own = { ...keptCopy(`ext:sillon:${NOW}`), fileId: 239, itemId: "ext-4da511bbbbeed1292dca931736d5b061" };
    h.tracks = [keptCopy(`ext:sillon:${OLD}`), own];
    await refreshKeptMusic();
    setKeptRenames(shownToFormer(renamesOf([item(NOW, [OLD])])));
    expect(completeKeptTrack(`ext:sillon:${NOW}`)?.fileId).toBe(239);
    h.tracks = [keptCopy(`ext:sillon:${OLD}`, "canceled")];
    await refreshKeptMusic();
    expect(keptMusicState().byKey.has(`ext:sillon:${NOW}`)).toBe(false);
  });
});
