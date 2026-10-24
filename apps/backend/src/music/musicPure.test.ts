/**
 * Les règles PURES de la musique : requête FTS5, mappage Jellyfin → index
 * (relevés du banc), choix de la bibliothèque, ordre des playlists, modèle du
 * contrat, rapports d'écoute, curseurs.
 */

import { describe, expect, it } from "vitest";
import { ftsMatchExpression, searchTokens } from "./index/searchQuery";
import { foldForSearch, ftsRowid } from "./index/rowCodec";
import { formatOf, recordingOf, rowFromItem } from "./jellyfin/itemMapping";
import { pickMusicLibrary } from "./jellyfin/musicLibrary";
import { insertedOrder, movedOrder, planRewrite } from "./playlists/playlistOrder";
import { artworkUrl, toTrack } from "./model/toMusic";
import { parsePlaybackReport } from "./media/playbackReport";
import { clampLimit, nextCursor, parseCursor } from "./view/viewContext";
import { likedOrder } from "./view/userViews";

describe("requête de recherche", () => {
  it("chaque mot devient un préfixe exigé, sans syntaxe FTS5", () => {
    expect(ftsMatchExpression("bri wi")).toBe('"bri"* "wi"*');
    expect(ftsMatchExpression('a OR "b" NEAR(c) -d:e')).toBe('"a"* "or"* "b"* "near"* "c"* "d"* "e"*');
    expect(ftsMatchExpression("  ¡¿…  ")).toBeNull();
    expect(searchTokens("Œuvre Four Beers’ Polka")).toEqual(["oeuvre", "four", "beers", "polka"]);
    expect(searchTokens("a b c d e f g h i j")).toHaveLength(8);
  });

  it("plie les ligatures, tire un rowid sous 2^53", () => {
    expect(foldForSearch("Œuvre, cœur, Æsir, Straße")).toBe("oeuvre, coeur, aesir, Strasse");
    expect(ftsRowid("ffffffffffffffffffffffffffffffff")).toBeLessThan(2 ** 53);
  });
});

describe("Jellyfin → index", () => {
  it("le DSF se dit en octets : fréquence × 8, un bit", () => {
    expect(formatOf({ Container: "dsf", Bitrate: 5644800, MediaStreams: [{ Type: "Audio", Codec: "dsd_lsbf_planar", SampleRate: 352800, BitDepth: 8, Channels: 2 }] })).toEqual({
      codec: "dsd", container: "dsf", sampleRate: 2822400, bitDepth: 1, bitrate: 5644800, channels: 2, lossless: true,
    });
    expect(formatOf({ Container: "wav", MediaStreams: [{ Type: "Audio", Codec: "pcm_s16le", SampleRate: 44100, BitDepth: 16 }] })?.codec).toBe("wav");
    expect(formatOf({ Container: "m4a", MediaStreams: [{ Type: "Audio", Codec: "aac" }] })?.lossless).toBe(false);
    expect(formatOf({ MediaStreams: [] })).toBeNull();
  });

  it("un titre : MBID d'enregistrement, artistes du crédit, pochette de l'album à défaut", () => {
    const r = rowFromItem({
      Id: "A97E5720-A59D-AF57-657A-B872402375A7", Type: "Audio", Name: "Ça déménage", AlbumId: "5ff6ca8bda175b41f495a274653dacde", Album: "Duos d'été",
      ArtistItems: [{ Id: "aa", Name: "Ensemble Témoin" }, { Id: "bb", Name: "Banc Octave" }], RunTimeTicks: 200_000_000, IndexNumber: 2,
      ProviderIds: { MusicBrainzRecording: "0C7A0E00-0000-4000-800D-000000000302", MusicBrainzArtist: "0c7a0e00-0000-4000-8000-0000000000a2" },
      AlbumPrimaryImageTag: "tag1", DateCreated: "2026-10-24T10:00:00.0000000Z",
    });
    expect(r).toMatchObject({
      id: "a97e5720a59daf57657ab872402375a7", kind: "track", durationMs: 20_000, trackNumber: 2,
      recordingMbid: "0c7a0e00-0000-4000-800d-000000000302", imageTag: "5ff6ca8bda175b41f495a274653dacde/tag1",
      dateCreated: Date.parse("2026-10-24T10:00:00Z"),
    });
    expect(r?.artists.map((a) => [a.name, a.mbid])).toEqual([["Ensemble Témoin", "0c7a0e00-0000-4000-8000-0000000000a2"], ["Banc Octave", null]]);
    expect(rowFromItem({ Id: "x", Type: "Playlist" })).toBeNull();
    // Un Jellyfin d'avant rangeait l'enregistrement dans `MusicBrainzTrack`.
    expect(recordingOf({ MusicBrainzTrack: "B0D63BE6-0394-4064-8848-CA928CC987FF" })).toBe("b0d63be6-0394-4064-8848-ca928cc987ff");
    expect(recordingOf({ MusicBrainzRecording: "0c7a0e00-0000-4000-800d-000000000301", MusicBrainzTrack: "b0d63be6-0394-4064-8848-ca928cc987ff" })).toBe("0c7a0e00-0000-4000-800d-000000000301");
  });

  it("la bibliothèque musique : la première par nom, ou celle que l'environnement force", () => {
    const folders = [
      { Name: "Films", ItemId: "f1", CollectionType: "movies" },
      { Name: "Zik", ItemId: "M-2", CollectionType: "music", Locations: ["/m2"] },
      { Name: "Musique", ItemId: "m1", CollectionType: "music", Locations: ["/music"] },
    ];
    expect(pickMusicLibrary(folders, undefined)).toEqual({ libraryId: "m1", name: "Musique", paths: ["/music"] });
    expect(pickMusicLibrary(folders, "m-2")?.name).toBe("Zik");
    expect(pickMusicLibrary(folders, "f1")).toBeNull();
    expect(pickMusicLibrary([], undefined)).toBeNull();
  });
});

describe("ordre d'une playlist réécrit par la fin", () => {
  const list = ["a", "b", "c", "d"].map((id) => ({ entryId: `e${id}`, itemId: id }));

  it("l'ordre voulu après une insertion : à une position, en fin, sans doublon", () => {
    expect(insertedOrder(list, ["x", "y"], 1)).toEqual(["a", "x", "y", "b", "c", "d"]);
    expect(insertedOrder(list, ["x"])).toEqual(["a", "b", "c", "d", "x"]);
    expect(insertedOrder(list, ["x"], 99)).toEqual(["a", "b", "c", "d", "x"]);
    expect(insertedOrder(list, ["c", "c"], 0)).toEqual(["c", "a", "b", "d"]);
  });

  it("l'ordre voulu après un déplacement", () => {
    expect(movedOrder(list, "ed", 0)).toEqual(["d", "a", "b", "c"]);
    expect(movedOrder(list, "eb", 2)).toEqual(["a", "c", "b", "d"]);
    expect(movedOrder(list, "ez", 0)).toBeNull();
  });

  it("la réécriture ne retire que la fin, à partir du premier rang qui diffère", () => {
    // Après l'ajout (Jellyfin met « x » à la fin), viser « a x b c d ».
    const afterAdd = [...list, { entryId: "ex", itemId: "x" }];
    expect(planRewrite(afterAdd, ["a", "x", "b", "c", "d"])).toEqual({ remove: ["eb", "ec", "ed", "ex"], append: ["x", "b", "c", "d"] });
    expect(planRewrite(list, ["a", "c", "b", "d"])).toEqual({ remove: ["eb", "ec", "ed"], append: ["c", "b", "d"] });
    expect(planRewrite(list, ["a", "b", "c", "d"])).toBeNull();
  });
});

describe("modèle du contrat", () => {
  it("une pochette passe par le cœur, son étiquette dans l'URL", () => {
    expect(artworkUrl("abc/t1")).toBe("/api/music/artwork/abc?tag=t1");
    expect(artworkUrl(null)).toBeNull();
  });

  it("un titre de la bibliothèque : clé jf:, cœur du compte, MBID d'artiste complété", () => {
    const row = rowFromItem({ Id: "c".repeat(32), Type: "Audio", Name: "T", ArtistItems: [{ Id: "a".repeat(32), Name: "A" }] })!;
    const track = toTrack(row, { favorites: new Set(["c".repeat(32)]), artistMbids: new Map([["a".repeat(32), "m-1"]]) });
    expect(track).toMatchObject({ key: `jf:${"c".repeat(32)}`, availability: "library", favorite: true, external: null });
    expect(track.mbids.artists).toEqual(["m-1"]);
  });

  it("« Titres likés » : artiste, album, disque, piste", () => {
    const base = rowFromItem({ Id: "1".repeat(32), Type: "Audio", Name: "z" })!;
    const rows = [
      { ...base, id: "3", albumArtist: "B", albumName: "X", trackNumber: 1 },
      { ...base, id: "2", albumArtist: "A", albumName: "Y", trackNumber: 2 },
      { ...base, id: "1", albumArtist: "A", albumName: "Y", trackNumber: 1 },
    ];
    expect(rows.sort(likedOrder).map((r) => r.id)).toEqual(["1", "2", "3"]);
  });
});

describe("entrées des routes", () => {
  it("un rapport d'écoute bien formé, et rien d'autre", () => {
    expect(parsePlaybackReport({ itemId: "c".repeat(32), positionMs: 1234.7, event: "stop", completed: true })).toEqual({ itemId: "c".repeat(32), positionMs: 1234, event: "stop", completed: true });
    expect(parsePlaybackReport({ itemId: "../x", positionMs: 0, event: "start" })).toBeNull();
    expect(parsePlaybackReport({ itemId: "c".repeat(32), positionMs: -1, event: "start" })).toBeNull();
    expect(parsePlaybackReport({ itemId: "c".repeat(32), positionMs: 0, event: "seek" })).toBeNull();
  });

  it("curseurs opaques et bornes", () => {
    expect(parseCursor(nextCursor(0, 50, 120))).toBe(50);
    expect(nextCursor(100, 20, 120)).toBeNull();
    expect(parseCursor("../")).toBe(0);
    expect(clampLimit("9999", 20, 50)).toBe(50);
    expect(clampLimit("abc", 20, 50)).toBe(20);
  });
});
