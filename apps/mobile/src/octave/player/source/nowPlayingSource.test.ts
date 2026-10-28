import { describe, expect, it } from "vitest";
import { nowPlayingSource, sourceKickerKey } from "./nowPlayingSource";

const track = {
  album: { title: "Imaginary Boys", mbid: null, jellyfinId: "alb1" },
  artists: [{ name: "The Cure", mbid: null, jellyfinId: "art1" }],
};
const external = { album: { title: "Sans bibliothèque", mbid: null, jellyfinId: null, external: { pluginId: "sillon", id: "x9" } }, artists: [] };

describe("d'où joue le lecteur (en-tête du lecteur plein écran)", () => {
  it("une file d'album rouvre l'album, nommé d'après le titre en cours", () => {
    expect(nowPlayingSource("album:alb1", track)).toEqual({ kind: "album", target: "alb1", name: "Imaginary Boys" });
  });

  it("un album d'extension garde sa clé ; un autre album que celui du titre reste sans nom", () => {
    expect(nowPlayingSource("album:ext:sillon:x9", external)).toEqual({ kind: "album", target: "ext:sillon:x9", name: "Sans bibliothèque" });
    expect(nowPlayingSource("album:zzz", track)).toEqual({ kind: "album", target: "zzz", name: null });
  });

  it("une playlist de la bibliothèque, ou d'une extension", () => {
    expect(nowPlayingSource("playlist:pl1", track)).toEqual({ kind: "playlist", id: "pl1" });
    expect(nowPlayingSource("playlist:ext:sillon:p2", track)).toEqual({ kind: "externalPlaylist", key: "ext:sillon:p2" });
  });

  it("les titres likés, un artiste, une ambiance", () => {
    expect(nowPlayingSource("liked", track)).toEqual({ kind: "liked" });
    expect(nowPlayingSource("playlist:liked", track)).toEqual({ kind: "liked" });
    expect(nowPlayingSource("artist:art1", track)).toEqual({ kind: "artist", target: "art1", name: "The Cure" });
    expect(nowPlayingSource("mood:chill", track)).toEqual({ kind: "mood", id: "chill" });
  });

  it("accueil, recherche, mix, appareil : l'album du titre en cours", () => {
    for (const context of ["home:recent", "home:most", "home:mix:artist:a", "search:cure:tracks", "device", null]) {
      expect(nowPlayingSource(context, track)).toEqual({ kind: "album", target: "alb1", name: "Imaginary Boys" });
    }
  });

  it("rien où aller : aucun bouton", () => {
    expect(nowPlayingSource("search:x", { album: null, artists: [] })).toBeNull();
    expect(nowPlayingSource("home:recent", { album: { title: "?", mbid: null, jellyfinId: null }, artists: [] })).toBeNull();
    expect(nowPlayingSource("album:", null)).toBeNull();
  });

  it("chaque source a sa ligne du dessus", () => {
    expect(sourceKickerKey({ kind: "externalPlaylist", key: "k" })).toBe("nowPlayingSource.fromPlaylist");
    expect(sourceKickerKey({ kind: "liked" })).toBe("nowPlayingSource.fromLiked");
  });
});
