import { describe, expect, it } from "vitest";
import type { MusicArtistRef, MusicTrack } from "@tentacle-tv/shared/music";
import { albumPathOf, artistPathOf, linkedArtistsOf } from "./trackTargets";

/**
 * Octave — où mène un titre (point 11) : la bibliothèque d'abord, sinon la vue
 * de l'extension (`external`), sinon nulle part — une extension d'avant, qui
 * n'envoie pas `external`, ne casse rien.
 */

const artist = (name: string, extra: Partial<MusicArtistRef> = {}): MusicArtistRef => ({ name, mbid: null, jellyfinId: null, ...extra });

describe("aller à l'album et à l'artiste d'un titre", () => {
  it("bibliothèque : l'élément Jellyfin, même si l'extension donne aussi le sien", () => {
    const track = { album: { title: "Evolve", mbid: null, jellyfinId: "jf-album", external: { pluginId: "p", id: "rel" } }, artists: [artist("ID", { jellyfinId: "jf-artist" })] };
    expect(albumPathOf(track)).toBe("/octave/album/jf-album");
    expect(artistPathOf(track.artists[0] as MusicArtistRef)).toBe("/octave/artist/jf-artist");
  });

  it("hors bibliothèque : la vue de l'extension, par sa clé `ext:`", () => {
    const track = { album: { title: "Evolve", mbid: null, jellyfinId: null, external: { pluginId: "music.x", id: "rel:42" } }, artists: [artist("ID", { external: { pluginId: "music.x", id: "art:7" } })] };
    expect(albumPathOf(track)).toBe(`/octave/album/${encodeURIComponent("ext:music.x:rel:42")}`);
    expect(linkedArtistsOf(track)).toEqual([{ name: "ID", path: `/octave/artist/${encodeURIComponent("ext:music.x:art:7")}` }]);
  });

  it("une extension d'avant, sans `external` : aucun lien, aucune erreur", () => {
    const legacy = { album: { title: "Evolve", mbid: "mb", jellyfinId: null }, artists: [artist("ID", { mbid: "mb2" })] } as Pick<MusicTrack, "album" | "artists">;
    expect(albumPathOf(legacy)).toBeNull();
    expect(linkedArtistsOf(legacy)).toEqual([]);
    expect(albumPathOf({ album: null })).toBeNull();
  });

  it("plusieurs artistes crédités : ceux qui ont une page, dans l'ordre du crédit", () => {
    const track = { artists: [artist("A", { jellyfinId: "a" }), artist("B"), artist("C", { jellyfinId: "c" })] };
    expect(linkedArtistsOf(track).map((a) => a.name)).toEqual(["A", "C"]);
  });
});
