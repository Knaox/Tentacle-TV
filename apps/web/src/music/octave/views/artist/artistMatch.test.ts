import { describe, expect, it } from "vitest";
import type { MusicAlbum, MusicTrack } from "@tentacle-tv/shared/music";
import { albumsElsewhere, libraryAlbumsMissing, normalizeArtistName, pickArtist, sameArtist, tracksElsewhere } from "./artistMatch";

/** Octave — la page d'un artiste rattache la bibliothèque et l'extension, sans jamais montrer deux fois la même chose. */

const MB = "8538e728-ca0b-4321-b7e5-cff6565dd4c0";
const artist = (name: string, mbid: string | null = null) => ({ name, mbid });

describe("rattacher un artiste", () => {
  it("le nom se compare sans casse, accents, ponctuation ni « The »", () => {
    expect(normalizeArtistName("Beyoncé")).toBe("beyonce");
    expect(normalizeArtistName("The  Beatles")).toBe("beatles");
    expect(normalizeArtistName("AC/DC")).toBe("ac dc");
    expect(normalizeArtistName("Simon & Garfunkel")).toBe(normalizeArtistName("simon and garfunkel"));
  });

  it("le MBID fait foi : deux MBID différents sont deux artistes, même homonymes", () => {
    expect(sameArtist(artist("Nirvana", MB), artist("NIRVANA", MB.toUpperCase()))).toBe(true);
    expect(sameArtist(artist("Nirvana", MB), artist("Nirvana", "00000000-0000-0000-0000-000000000000"))).toBe(false);
    expect(sameArtist(artist("Nirvana", MB), artist("nirvana"))).toBe(true);
    expect(sameArtist(artist(""), artist(""))).toBe(false);
  });

  it("parmi des candidats : le MBID égal d'abord, sinon le nom", () => {
    const candidates = [artist("Imagine Dragons Tribute"), artist("Imagine dragons"), artist("X", MB)];
    expect(pickArtist(artist("Whatever", MB), candidates)?.name).toBe("X");
    expect(pickArtist(artist("Imagine Dragons"), candidates)?.name).toBe("Imagine dragons");
    expect(pickArtist(artist("Personne"), candidates)).toBeNull();
  });
});

describe("jamais de doublon", () => {
  const track = (key: string, jellyfinId: string | null) => ({ key, jellyfinId }) as MusicTrack;
  const album = (key: string, jellyfinId: string | null) => ({ key, jellyfinId }) as MusicAlbum;

  it("d'ailleurs : seulement ce que la bibliothèque n'a pas (un album en partie présent compte comme présent)", () => {
    expect(tracksElsewhere([track("ext:a", null), track("jf:b", "b")]).map((t) => t.key)).toEqual(["ext:a"]);
    const shown = [
      { album: album("ext:1", null), ownership: null },
      { album: album("ext:2", null), ownership: "partial" as const },
      { album: album("jf:3", "3"), ownership: "full" as const },
    ];
    expect(albumsElsewhere(shown).map((a) => a.album.key)).toEqual(["ext:1"]);
  });

  it("un artiste d'ailleurs : les albums de la bibliothèque que la page ne montre pas encore", () => {
    const shown = [{ album: album("jf:3", "3"), ownership: "full" as const }];
    expect(libraryAlbumsMissing([album("jf:3", "3"), album("jf:4", "4")], shown).map((a) => a.album.key)).toEqual(["jf:4"]);
  });
});
