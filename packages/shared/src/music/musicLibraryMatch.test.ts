import { describe, expect, it } from "vitest";
import { baseTitle, bestMatch, isSameAlbum, isSameAlbumTrack, isSameTrack, type MatchableAlbum, type MatchableTrack } from "./musicLibraryMatch";

const VA = "89ad4ac3-39f7-470e-963a-56509c546377";
const CORBIN = "ed90e969-f95f-40cc-8751-db2c467bf529";
const OST = "Cyberpunk: Edgerunners 2 (Original Series Soundtrack)";

const track = (over: Partial<MatchableTrack> = {}): MatchableTrack => ({ title: "Worth It", artists: [{ name: "Corbin", mbid: null }], albumTitle: OST, durationMs: 161_984, recording: null, ...over });
const album = (over: Partial<MatchableAlbum> = {}): MatchableAlbum => ({ title: OST, artists: [{ name: "Various Artists", mbid: null }], release: null, releaseGroup: null, compilation: false, ...over });

// La ligne de l'index de Damien (25/10) : Jellyfin crédite la piste à « Various Artists », avec le MBID de l'interprète.
const ownWorthIt = track({ artists: [{ name: "Various Artists", mbid: CORBIN }], recording: "15befd0f-2c0c-49f5-b863-d254bbddbe90" });

describe("titres", () => {
  it("une compilation créditée « Various Artists » : le MBID de l'interprète suffit", () => {
    expect(isSameTrack(ownWorthIt, track({ artists: [{ name: "Corbin", mbid: CORBIN }], durationMs: 162_000 }))).toBe(true);
  });

  it("sans MBID d'artiste : le même album et la même durée", () => {
    expect(isSameTrack(ownWorthIt, track({ durationMs: 161_000 }))).toBe(true);
    expect(isSameTrack(ownWorthIt, track({ albumTitle: "Autre chose", durationMs: 161_000 }))).toBe(false);
    expect(isSameTrack(ownWorthIt, track({ durationMs: null }))).toBe(false);
  });

  it("un homonyme n'est jamais pris : même titre, autre artiste", () => {
    expect(isSameTrack(track(), track({ artists: [{ name: "Fifth Harmony", mbid: null }], albumTitle: "7/27", durationMs: 161_984 }))).toBe(false);
    expect(isSameTrack(ownWorthIt, track({ artists: [{ name: "Fifth Harmony", mbid: null }], albumTitle: "7/27", durationMs: 224_000 }))).toBe(false);
  });

  it("« Various Artists » n'est jamais un artiste commun", () => {
    const various = [{ name: "Various Artists", mbid: VA }];
    expect(isSameTrack(track({ artists: various, albumTitle: "Hits 2020" }), track({ artists: various, albumTitle: "Hits 2021" }))).toBe(false);
  });

  it("la durée départage les versions (± 2 s)", () => {
    expect(isSameTrack(track(), track({ durationMs: 163_900 }))).toBe(true);
    expect(isSameTrack(track(), track({ durationMs: 164_100 }))).toBe(false);
    expect(isSameTrack(track({ title: "Song" }), track({ title: "Song (Live)", durationMs: 161_984 }))).toBe(false);
  });

  it("le MBID d'enregistrement tranche seul", () => {
    const rec = "6ad408a2-797a-426c-8ab4-c75481265b1e";
    expect(isSameTrack(track({ recording: rec }), track({ recording: rec, title: "Autre titre", durationMs: 1 }))).toBe(true);
    expect(isSameTrack(track({ recording: rec }), track({ recording: "4a6428c7-178d-48bb-81ae-7fb1e264da80" }))).toBe(false);
  });

  it("invités, « from … », remasterisation : le titre de base", () => {
    expect(baseTitle("Worth It (from Cyberpunk: Edgerunners 2)")).toBe("worth it");
    expect(baseTitle("Song (feat. Someone)")).toBe("song");
    expect(baseTitle("Song - Remastered 2011")).toBe("song");
    expect(baseTitle("Song (Live)")).toBe("song live");
    expect(isSameTrack(track({ title: "Worth It (feat. X)" }), track())).toBe(true);
  });

  it("crédits découpés : « A & B » partage A", () => {
    expect(isSameTrack(track({ artists: [{ name: "Simon & Garfunkel", mbid: null }] }), track({ artists: [{ name: "Simon and Garfunkel", mbid: null }] }))).toBe(true);
    expect(isSameTrack(track({ artists: [{ name: "Corbin feat. DOUDOU", mbid: null }] }), track())).toBe(true);
  });

  it("bestMatch : le plus proche en durée", () => {
    const own = [track({ durationMs: 160_100 }), track({ durationMs: 161_900 })];
    expect(bestMatch(track(), own, (x) => x)).toBe(own[1]);
    expect(bestMatch(track({ title: "Rien" }), own, (x) => x)).toBeNull();
  });
});

describe("albums", () => {
  it("une bande originale : « Various Artists » d'un côté, les interprètes de l'autre", () => {
    expect(isSameAlbum(album({ compilation: true }), album({ artists: [{ name: "Tsuneo Imahori", mbid: null }] }))).toBe(true);
  });

  it("un homonyme d'album exige un artiste commun", () => {
    const queen = album({ title: "Greatest Hits", artists: [{ name: "Queen", mbid: null }] });
    expect(isSameAlbum(queen, album({ title: "Greatest Hits", artists: [{ name: "ABBA", mbid: null }] }))).toBe(false);
    expect(isSameAlbum(queen, album({ title: "Greatest Hits", artists: [{ name: "Queen", mbid: null }] }))).toBe(true);
  });

  it("les MBID de parution et de groupe tranchent", () => {
    const rg = "f90e8f69-1f06-4aae-9c28-74d4b8220fe1";
    expect(isSameAlbum(album({ releaseGroup: rg }), album({ title: "Autre", releaseGroup: rg }))).toBe(true);
    expect(isSameAlbum(album({ releaseGroup: rg }), album({ releaseGroup: "00000000-0000-4000-8000-000000000000" }))).toBe(false);
  });

  it("dans un album reconnu : le titre, ou la place, à ± 2 s", () => {
    const own = track({ title: "Da mi jeszce jedna szanse", trackNumber: 5, discNumber: 1, durationMs: 254_537 });
    expect(isSameAlbumTrack(own, track({ title: "Give Me One More Chance", trackNumber: 5, discNumber: 1, durationMs: 254_000 }))).toBe(true);
    expect(isSameAlbumTrack(own, track({ title: "Give Me One More Chance", trackNumber: 5, durationMs: 200_000 }))).toBe(false);
    expect(isSameAlbumTrack(own, track({ title: "Give Me One More Chance", trackNumber: 6, durationMs: 254_000 }))).toBe(false);
    expect(isSameAlbumTrack(own, track({ title: "Da mi jeszce jedna szanse", artists: [], durationMs: 254_537 }))).toBe(true);
  });
});
