import { describe, expect, it } from "vitest";
import type { MusicAlbum, MusicTrack } from "../../music/musicTypes";
import { isUnavailableAlbum, unavailableAlbumPhase, unavailableAlbumTracks } from "./unavailableAlbum";

const album = (over: Partial<MusicAlbum> = {}): MusicAlbum => ({
  key: "ext:sillon:imp:al:x", jellyfinId: null, external: { pluginId: "sillon", id: "imp:al:x" }, title: "Truth Lies in-Between",
  artists: [{ name: "John Tchicai Trio", mbid: null, jellyfinId: null }], year: null, releaseDate: null, kind: "album", artworkUrl: null,
  trackCount: 12, durationMs: null, mbids: { release: null, releaseGroup: null }, unavailable: "notStreamable", ...over,
});
const track = { key: "ext:sillon:rec:1", title: "Truth" } as MusicTrack;

describe("album pas lisible", () => {
  it("grisé seulement s'il le dit, hors bibliothèque et sans titre de la bibliothèque", () => {
    expect(isUnavailableAlbum(album())).toBe(true);
    expect(isUnavailableAlbum(album({ unavailable: null }))).toBe(false);
    expect(isUnavailableAlbum(album({ unavailable: undefined }))).toBe(false);
    expect(isUnavailableAlbum(album({ jellyfinId: "jf1" }))).toBe(false);
    expect(isUnavailableAlbum(album(), "full")).toBe(false);
    expect(isUnavailableAlbum(album(), "partial")).toBe(false);
  });

  it("une valeur inconnue (une extension plus récente) se lit comme « pas lisible »", () => {
    expect(isUnavailableAlbum(album({ unavailable: "geoBlocked" as never }))).toBe(true);
  });

  it("la feuille : chargement, prêt, finalement lisible, introuvable, panne", () => {
    expect(unavailableAlbumPhase({ data: undefined, isPending: true, isError: false })).toBe("loading");
    expect(unavailableAlbumPhase({ data: undefined, isPending: false, isError: true })).toBe("failed");
    expect(unavailableAlbumPhase({ data: null, isPending: false, isError: false })).toBe("lost");
    expect(unavailableAlbumPhase({ data: album({ tracks: [] }), isPending: false, isError: false })).toBe("lost");
    expect(unavailableAlbumPhase({ data: album({ tracks: [track] }), isPending: false, isError: false })).toBe("ready");
    expect(unavailableAlbumPhase({ data: album({ unavailable: null, tracks: [track] }), isPending: false, isError: false })).toBe("playable");
  });

  it("les titres à aimer ou ajouter : seulement quand la feuille est prête", () => {
    expect(unavailableAlbumTracks("ready", album({ tracks: [track] }))).toEqual([track]);
    expect(unavailableAlbumTracks("loading", album({ tracks: [track] }))).toEqual([]);
    expect(unavailableAlbumTracks("playable", album({ tracks: [track] }))).toEqual([]);
  });
});
