import { describe, expect, it } from "vitest";
import type { MusicArtist, MusicTrack } from "@tentacle-tv/shared/music";
import { hasForYou, isHomeEmpty, mixContextId, mixMosaic, mixSubtitle, mixTitle, resumeOffer, resumeShown } from "./homeModel";

const track = (key: string, artworkUrl: string | null) => ({ key, artworkUrl }) as MusicTrack;
const artist = { name: "Air" } as MusicArtist;

describe("homeModel", () => {
  it("la mosaïque : quatre pochettes distinctes, sinon une seule", () => {
    expect(mixMosaic([track("1", "a"), track("2", "a"), track("3", "b"), track("4", null), track("5", "c"), track("6", "d"), track("7", "e")])).toEqual(["a", "b", "c", "d"]);
    expect(mixMosaic([track("1", "a"), track("2", "b"), track("3", "c")])).toEqual(["a"]);
    expect(mixMosaic([track("1", null)])).toEqual([]);
  });

  it("le nom et le sous-titre d'un mix", () => {
    expect(mixTitle({ kind: "artist", artist })).toEqual({ key: "octaveHome.mixArtist", artist: "Air" });
    expect(mixTitle({ kind: "favorites", artist: null })).toEqual({ key: "octaveHome.mixFavorites" });
    expect(mixSubtitle({ artistNames: ["Air", "Justice", "Daft Punk", "Moby"] }, "fr")).toBe("Air, Justice et Daft Punk");
    expect(mixSubtitle({ artistNames: ["Air", "Justice"] }, "en")).toBe("Air and Justice");
    expect(mixContextId({ id: "artist:x" })).toBe("home:mix:artist:x");
  });

  it("la reprise : un titre gardé en pause, rien pendant l'écoute", () => {
    const t = track("1", null);
    expect(resumeOffer(t, false)).toBe(t);
    expect(resumeOffer(t, true)).toBeNull();
    expect(resumeOffer(null, false)).toBeNull();
  });

  it("la carte de reprise apparaît à l'arrivée seulement, puis reste tant qu'il y a un titre", () => {
    const t = track("1", null);
    expect(resumeShown(false, true, t, false)).toBe(true);
    expect(resumeShown(false, false, t, false)).toBe(false);
    expect(resumeShown(true, false, t, true)).toBe(true);
    expect(resumeShown(true, false, null, false)).toBe(false);
    expect(resumeShown(false, true, t, true)).toBe(false);
  });
});

describe("accueil vide, rangées « pour vous »", () => {
  const home = { recentlyPlayed: [], recentlyAdded: [], mostPlayed: [], playlists: [] };
  it("un serveur d'avant (sans forYou) et rien d'écouté : vide", () => {
    expect(hasForYou(undefined)).toBe(false);
    expect(isHomeEmpty(home)).toBe(true);
  });
  it("un mix du jour suffit à remplir l'accueil", () => {
    const forYou = { mixes: [{ id: "favorites" }], recentAlbums: [], because: [], recentArtists: [] } as never;
    expect(isHomeEmpty({ ...home, forYou })).toBe(false);
  });
});
