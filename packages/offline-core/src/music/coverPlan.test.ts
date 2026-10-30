import { describe, expect, it } from "vitest";
import type { KeptMusicTrack } from "../core/musicLibrary";
import { mosaicCandidates, pickMosaic, type MusicPlaylist, type MusicTrack } from "@tentacle-tv/shared/music";
import { coversToRead, imagePlan, keptCoverOf, keptCoverUrls, localCoversByUrl, sameCover, shownArtworkUrl, shownCoverUrls, type KeptCover } from "./coverPlan";

const NOW = Date.UTC(2026, 9, 28, 12);
const DAY = 86_400_000;

function track(album: string, n: number): MusicTrack {
  const id = `${album}${n}`;
  return {
    key: `jf:${id}`, jellyfinId: id, external: null, title: id, artists: [{ name: `art-${album}`, mbid: null, jellyfinId: `ar${album}` }],
    album: { title: album, mbid: null, jellyfinId: `al${album}` }, durationMs: 1, trackNumber: n, discNumber: 1, year: null,
    artworkUrl: `/api/music/artwork/${id}?tag=x`, mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "library", format: null, favorite: false,
  };
}
const tracks = Array.from({ length: 12 }, (_, k) => [track(`a${k}`, 1), track(`a${k}`, 2)]).flat();
const candidates = mosaicCandidates(tracks);
const cover = (handPlaced = false): KeptCover => ({ playlistId: "p1", artworkUrl: "/api/music/artwork/p1?tag=img", cover: { handPlaced, candidates }, savedAt: 0 });
const listed = (mosaic: string[] | undefined, artworkUrl = "/api/music/artwork/p1?tag=img"): MusicPlaylist => ({ jellyfinId: "p1", name: "New", trackCount: 24, durationMs: null, artworkUrl, editable: true, ...(mosaic ? { mosaic } : {}) });

function kept(t: MusicTrack, coverRel: string | null = `music/${t.key}.jpg`): KeptMusicTrack {
  return {
    fileId: 1, itemId: t.jellyfinId!, trackKey: t.key, origin: "library", variant: "original", preset: null, status: "complete", errorCode: null, pausedByUser: false,
    bytesDone: 1, expectedSize: 1, title: t.title, artist: null, album: null, albumKey: null, discNumber: 1, trackNumber: 1, durationMs: 1, coverRel, sourcePath: null,
    trackJson: JSON.stringify(t), createdAt: 0,
  };
}

describe("la jaquette gardée = la jaquette en ligne", () => {
  it("chaque jour, la mosaïque gardée est celle que le cœur montre (même règle, même graine)", () => {
    for (let d = 0; d < 20; d++) expect(keptCoverUrls(cover(), NOW + d * DAY)).toEqual(pickMosaic(candidates, "p1", NOW + d * DAY));
  });

  it("posée à la main : la même image, tous les jours", () => {
    expect(keptCoverUrls(cover(true), NOW)).toEqual(["/api/music/artwork/p1?tag=img"]);
    expect(keptCoverUrls(cover(true), NOW + 9 * DAY)).toEqual(["/api/music/artwork/p1?tag=img"]);
  });

  it("un serveur d'avant (pas de couverture) : rien à garder", () => {
    expect(keptCoverOf({ jellyfinId: "p1", artworkUrl: null }, NOW)).toBeNull();
    expect(keptCoverOf({ jellyfinId: "p1", artworkUrl: "/x", cover: { handPlaced: false, candidates } }, NOW)?.cover.candidates).toHaveLength(12);
  });
});

describe("coversToRead", () => {
  it("jamais lue : à lire ; lue et toujours juste : rien ; la liste a changé (album ajouté, image posée) : à relire", () => {
    const today = pickMosaic(candidates, "p1", NOW);
    expect(coversToRead(["p1"], new Map(), [listed(today)], NOW)).toEqual(["p1"]);
    expect(coversToRead(["p1"], new Map([["p1", cover()]]), [listed(today)], NOW)).toEqual([]);
    expect(coversToRead(["p1"], new Map([["p1", cover()]]), [listed(undefined, "/api/music/artwork/p1?tag=new")], NOW)).toEqual(["p1"]);
    expect(coversToRead(["p1"], new Map([["p1", cover(true)]]), [listed(undefined)], NOW)).toEqual([]);
  });

  it("une playlist que la liste ne connaît pas n'est pas relue", () => {
    expect(coversToRead(["gone"], new Map(), [listed(undefined)], NOW)).toEqual([]);
  });

  it("le lendemain, la couverture gardée tourne comme la liste : rien à relire", () => {
    expect(coversToRead(["p1"], new Map([["p1", cover()]]), [listed(pickMosaic(candidates, "p1", NOW + DAY))], NOW + DAY)).toEqual([]);
  });
});

describe("images", () => {
  const local = localCoversByUrl(tracks.slice(0, 6).map((t) => kept(t)), (rel) => `tentacle://local/${rel}`);

  it("la pochette gardée d'un titre sert quand c'est la même adresse", () => {
    expect(local.get(tracks[0]!.artworkUrl!)).toBe("tentacle://local/music/jf:a01.jpg");
    expect(localCoversByUrl([kept(tracks[0]!, null)], (rel) => rel).size).toBe(0);
  });

  it("à copier : les candidates sans pochette gardée ni copie ; à oublier : ce que plus rien ne montre", () => {
    const plan = imagePlan([cover()], local, new Set(["/api/music/artwork/a51?tag=x", "/old"]));
    // 12 albums ; a0, a1, a2 ont leur pochette gardée (premier titre), a5 a sa copie.
    expect(plan.fetch).toHaveLength(8);
    expect(plan.drop).toEqual(["/old"]);
  });

  it("posée à la main : seule son image est gardée", () => {
    expect(imagePlan([cover(true)], new Map(), new Set())).toEqual({ fetch: ["/api/music/artwork/p1?tag=img"], drop: [] });
  });

  it("montrées : la pochette gardée, la copie, le serveur avec du réseau ; sans réseau, jamais une adresse qui ne charge pas", () => {
    const copies = new Map([["/b", "blob:x"]]);
    expect(shownCoverUrls(["/a", "/b", "/c"], new Map([["/a", "tentacle://local/a"]]), copies, true)).toEqual(["tentacle://local/a", "blob:x", "/c"]);
    expect(shownCoverUrls(["/c"], new Map(), copies, false)).toEqual([null]);
  });

  it("sameCover : rien à réécrire si la jaquette sera la même tous les jours", () => {
    expect(sameCover(cover(), { ...cover(), savedAt: 9 })).toBe(true);
    expect(sameCover(cover(), cover(true))).toBe(false);
    expect(sameCover(undefined, cover())).toBe(false);
  });
});

describe("shownArtworkUrl : la pochette gardée, partout hors ligne", () => {
  const local = new Map([["/api/music/art/a1?tag=x", "file:///kept/a1.jpg"]]);

  it("hors ligne : la pochette gardée de la même adresse (l'album et ses titres)", () => {
    expect(shownArtworkUrl("/api/music/art/a1?tag=x", local, true)).toBe("file:///kept/a1.jpg");
  });

  it("hors ligne sans pochette gardée : l'adresse (le cache d'images peut l'avoir)", () => {
    expect(shownArtworkUrl("/api/music/art/b2?tag=y", local, true)).toBe("/api/music/art/b2?tag=y");
  });

  it("en ligne : l'adresse du serveur, inchangée", () => {
    expect(shownArtworkUrl("/api/music/art/a1?tag=x", local, false)).toBe("/api/music/art/a1?tag=x");
    expect(shownArtworkUrl(null, local, true)).toBeNull();
  });
});
