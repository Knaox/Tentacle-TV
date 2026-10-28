import { describe, expect, it } from "vitest";
import { MOSAIC_PERIOD_MS, artworkOwner, coverImagesOf, coverUrlsOf, mosaicCandidates, pickMosaic, playlistMosaic, type MosaicTrack } from "./musicMosaic";

const DAY = MOSAIC_PERIOD_MS;
const NOW = Date.UTC(2026, 9, 28, 12);

/** Un titre de l'album `album` (artiste `artist`) dont la pochette est celle de l'album, ou embarquée (`own`). */
function track(album: string, artist: string, options: { own?: string; art?: string | null; albumId?: string | null } = {}): MosaicTrack {
  const art = options.art !== undefined ? options.art : `/api/music/artwork/${options.own ?? `al${album}`}?tag=t`;
  return { album: { title: `Album ${album}`, jellyfinId: options.albumId !== undefined ? options.albumId : `al${album}` }, artists: [{ name: artist, jellyfinId: `ar${artist}` }], artworkUrl: art };
}

/** Une playlist de `n` albums de `artists` artistes, deux titres par album à pochette embarquée. */
function playlist(n: number, artists = n): MosaicTrack[] {
  return Array.from({ length: n }, (_, k) => [track(String(k), String(k % artists), { own: `t${k}a` }), track(String(k), String(k % artists), { own: `t${k}b` })]).flat();
}

/** Les albums montrés (la pochette d'un album peut venir de l'un ou l'autre de ses titres). */
const albumsOf = (tracks: MosaicTrack[], urls: string[]) => urls.map((u) => mosaicCandidates(tracks).find((c) => c.url === u)!.album);

describe("mosaicCandidates", () => {
  it("un album = une case, même avec des pochettes embarquées différentes par titre (le cas « deux fois Arcane »)", () => {
    const tracks = [track("arcane", "x", { own: "t1" }), track("arcane", "x", { own: "t2" }), track("id", "y", { own: "t3" }), track("id", "y", { own: "t4" })];
    expect(mosaicCandidates(tracks).map((c) => c.album)).toEqual(["jf:alarcane", "jf:alid"]);
  });

  it("un titre sans image, ou à l'image de son artiste, n'est pas candidat", () => {
    const tracks = [track("a", "x", { art: null }), track("b", "x", { art: "/api/music/artwork/arx?tag=1" }), track("c", "x")];
    expect(mosaicCandidates(tracks).map((c) => c.album)).toEqual(["jf:alc"]);
  });

  it("jamais deux fois la même image, même pour deux albums", () => {
    const tracks = [track("a", "x", { own: "same" }), track("b", "y", { own: "same" })];
    expect(mosaicCandidates(tracks)).toHaveLength(1);
  });

  it("sans élément d'album, le nom et l'artiste font l'identité", () => {
    const tracks = [track("a", "x", { albumId: null, own: "1" }), track("a", "x", { albumId: null, own: "2" }), track("a", "y", { albumId: null, own: "3" })];
    expect(mosaicCandidates(tracks)).toHaveLength(2);
  });

  it("l'image montrée peut être une autre (pochette locale) ; l'éligibilité reste celle du serveur", () => {
    const tracks = [track("a", "x", { own: "1" }), track("b", "y", { own: "2" })];
    const local = mosaicCandidates(tracks, (t) => (t.artworkUrl!.includes("/1?") ? "file:///a.jpg" : null));
    expect(local.map((c) => c.url)).toEqual(["file:///a.jpg"]);
  });

  it("`last` est la place du DERNIER titre de l'album", () => {
    const tracks = [track("a", "x"), track("b", "y"), track("a", "x", { own: "z" })];
    expect(mosaicCandidates(tracks).find((c) => c.album === "jf:ala")?.last).toBe(2);
  });
});

describe("pickMosaic", () => {
  it("aucun candidat : aucune image (le repli de la carte)", () => {
    expect(playlistMosaic([], "p", NOW)).toEqual([]);
  });

  it("moins de quatre albums : UNE pochette, jamais une case vide ni un doublon", () => {
    for (const n of [1, 2, 3]) expect(playlistMosaic(playlist(n), "p", NOW)).toHaveLength(1);
  });

  it("quatre albums ou plus : quatre images d'albums différents", () => {
    for (const n of [4, 5, 12, 95]) {
      const urls = playlistMosaic(playlist(n), "p", NOW);
      expect(urls).toHaveLength(4);
      expect(new Set(urls).size).toBe(4);
    }
  });

  it("stable dans la période (même jour, même résultat), et elle tourne d'un jour à l'autre", () => {
    const tracks = playlist(40);
    const morning = playlistMosaic(tracks, "p", Date.UTC(2026, 9, 28, 0, 0, 1));
    expect(playlistMosaic(tracks, "p", Date.UTC(2026, 9, 28, 23, 59, 59))).toEqual(morning);
    const days = new Set(Array.from({ length: 10 }, (_, d) => playlistMosaic(tracks, "p", NOW + d * DAY).join()));
    expect(days.size).toBeGreaterThan(7);
  });

  it("deux playlists aux mêmes titres n'ont pas la même jaquette le même jour", () => {
    const tracks = playlist(40);
    expect(playlistMosaic(tracks, "p1", NOW)).not.toEqual(playlistMosaic(tracks, "p2", NOW));
  });

  it("l'ordre des titres ne change pas les albums montrés (hors fenêtre des récents)", () => {
    const tracks = playlist(30);
    const head = tracks.slice(0, 40);
    const tail = tracks.slice(40);
    const shuffled = [...head].reverse().concat(tail);
    expect(new Set(albumsOf(shuffled, playlistMosaic(shuffled, "p", NOW)))).toEqual(new Set(albumsOf(tracks, playlistMosaic(tracks, "p", NOW))));
  });

  it("un album de la fin de la playlist (les ajouts récents) a toujours une case", () => {
    const tracks = playlist(50);
    const recent = new Set(Array.from({ length: 10 }, (_, k) => `jf:al${40 + k}`));
    for (let d = 0; d < 30; d++) {
      expect(albumsOf(tracks, playlistMosaic(tracks, "p", NOW + d * DAY)).some((a) => recent.has(a))).toBe(true);
    }
  });

  it("un ajout n'entre que s'il est mieux noté : jamais tout rebattu", () => {
    const tracks = playlist(60);
    let changed = 0;
    for (let d = 0; d < 40; d++) {
      const before = new Set(playlistMosaic(tracks, "p", NOW + d * DAY));
      const after = new Set(playlistMosaic([...tracks, track("new", "z")], "p", NOW + d * DAY));
      const kept = [...before].filter((u) => after.has(u)).length;
      expect(kept).toBeGreaterThanOrEqual(2);
      if (kept < 4) changed++;
    }
    // Le nouvel album entre de temps en temps, pas tous les jours.
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThan(40);
  });

  it("varie les artistes tant qu'il y en a assez", () => {
    // 20 albums de 4 artistes : quatre artistes différents chaque jour.
    const tracks = playlist(20, 4);
    for (let d = 0; d < 20; d++) {
      const candidates = mosaicCandidates(tracks);
      const urls = pickMosaic(candidates, "p", NOW + d * DAY);
      const artists = urls.map((u) => candidates.find((c) => c.url === u)!.artist);
      expect(new Set(artists).size).toBe(4);
    }
  });

  it("un seul artiste : quatre albums de lui, sans doublon", () => {
    const urls = playlistMosaic(playlist(6, 1), "p", NOW);
    expect(new Set(urls).size).toBe(4);
  });

  it("la playlist « New » : 189 titres où deux albums dominent la tête → quatre albums différents", () => {
    const head = [...Array.from({ length: 6 }, (_, k) => track("arcane", "arcane", { own: `a${k}` })), ...Array.from({ length: 6 }, (_, k) => track("id", "imagine", { own: `i${k}` }))];
    const rest = Array.from({ length: 177 }, (_, k) => track(`r${k % 70}`, `art${k % 45}`, { own: `r${k}` }));
    const urls = playlistMosaic([...head, ...rest], "016730ba", NOW);
    expect(urls).toHaveLength(4);
    expect(new Set(albumsOf([...head, ...rest], urls)).size).toBe(4);
  });
});

describe("artworkOwner", () => {
  it("lit l'élément d'une pochette du cœur, en minuscules sans tirets", () => {
    expect(artworkOwner("/api/music/artwork/AB-CD?tag=1")).toBe("abcd");
    expect(artworkOwner("https://example.org/cover.jpg")).toBeNull();
  });
});

describe("coverUrlsOf / coverImagesOf", () => {
  const candidates = mosaicCandidates(playlist(8));
  it("la mosaïque du jour, exactement celle du cœur (même règle, même graine)", () => {
    expect(coverUrlsOf({ handPlaced: false, candidates }, "/collage", "p", NOW)).toEqual(pickMosaic(candidates, "p", NOW));
  });

  it("posée à la main : l'image de la playlist, toujours ; et c'est la seule à garder", () => {
    expect(coverUrlsOf({ handPlaced: true, candidates }, "/mine", "p", NOW)).toEqual(["/mine"]);
    expect(coverImagesOf({ handPlaced: true, candidates }, "/mine")).toEqual(["/mine"]);
  });

  it("aucun candidat : le collage de Jellyfin, sinon rien", () => {
    expect(coverUrlsOf({ handPlaced: false, candidates: [] }, "/collage", "p", NOW)).toEqual(["/collage"]);
    expect(coverUrlsOf({ handPlaced: false, candidates: [] }, null, "p", NOW)).toEqual([]);
  });

  it("à garder : toutes les pochettes candidates (chaque jour en montre d'autres)", () => {
    expect(coverImagesOf({ handPlaced: false, candidates }, "/collage")).toHaveLength(8);
  });
});
