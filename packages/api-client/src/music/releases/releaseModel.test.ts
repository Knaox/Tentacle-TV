import { describe, expect, it } from "vitest";
import { importedLibraryState, pickReleaseLot, albumHintOf, releaseArtForPixels, isImportableAudio, readReleaseRefusal, releaseFraction, remainingChunks } from "./releaseModel";

describe("modèle client de l'import de sorties", () => {
  it("propose l'audio par type ou par extension", () => {
    expect(isImportableAudio("x.FLAC", "")).toBe(true);
    expect(isImportableAudio("x.bin", "audio/mpeg")).toBe(true);
    expect(isImportableAudio("pochette.jpg", "image/jpeg")).toBe(false);
  });
  it("reprend où le serveur s'est arrêté", () => {
    expect(remainingChunks(10, 0, 4)).toEqual([{ start: 0, end: 4 }, { start: 4, end: 8 }, { start: 8, end: 10 }]);
    expect(remainingChunks(10, 8, 4)).toEqual([{ start: 8, end: 10 }]);
    expect(remainingChunks(10, 10, 4)).toEqual([]);
  });
  it("avance sans jamais finir avant la fin", () => {
    expect(releaseFraction({ state: "receiving" }, 50, 100)).toBeCloseTo(0.45);
    expect(releaseFraction({ state: "reading" }, 100, 100)).toBeCloseTo(0.95);
    expect(releaseFraction({ state: "done" }, 0, 100)).toBe(1);
  });
  it("un refus inconnu devient « failed »", () => {
    expect(readReleaseRefusal("quota")).toBe("quota");
    expect(readReleaseRefusal("autre")).toBe("failed");
  });
  it("le dossier commun nomme l'album d'un lot sans tag", () => {
    expect(albumHintOf(["Bastien Becker/Édition spéciale/01.flac", "Bastien Becker/Édition spéciale/02.flac"])).toBe("Édition spéciale");
    expect(albumHintOf(["a/01.flac", "b/02.flac"])).toBeUndefined();
    expect(albumHintOf(["01.flac"])).toBeUndefined();
  });
  it("une pochette importée prend la plus petite taille qui couvre sa place", () => {
    const art = "/api/plugins/sillon/music/releases/art/a1/700";
    expect(releaseArtForPixels(art, 120)).toBe("/api/plugins/sillon/music/releases/art/a1/300");
    expect(releaseArtForPixels(art, 1000)).toBe("/api/plugins/sillon/music/releases/art/a1/1200");
    expect(releaseArtForPixels(art, 2400)).toBe("/api/plugins/sillon/music/releases/art/a1/full");
    expect(releaseArtForPixels("/api/music/artwork/x", 120)).toBe("/api/music/artwork/x");
  });
  it("un lot garde l'audio ET les images de pochette (25 Mo au plus), l'audio d'abord", () => {
    const f = (name: string, type = "", size = 10) => ({ name, type, size });
    const lot = pickReleaseLot([f("cover.png", "image/png"), f("01.flac"), f("notes.pdf", "application/pdf"), f("geante.jpg", "image/jpeg", 30 * 1024 * 1024), f("02.mp3")], 100);
    expect(lot.files.map((x) => x.name)).toEqual(["01.flac", "02.mp3", "cover.png"]);
    expect(lot).toMatchObject({ ignored: 2, truncated: false, audio: 2, covers: 1 });
    expect(pickReleaseLot([f("a.png"), f("b.mp3")], 1).files.map((x) => x.name)).toEqual(["b.mp3"]);
  });
  it("le ZIP d'un achat Bandcamp part tel quel, comme un fichier qui porte des titres", () => {
    const f = (name: string, type = "", size = 10) => ({ name, type, size });
    const lot = pickReleaseLot([f("cover.png", "image/png"), f("Bastian Baker - TRUTH LIES IN BETWEEN.zip", "application/zip", 392e6)], 100);
    expect(lot.files.map((x) => x.name)).toEqual(["Bastian Baker - TRUTH LIES IN BETWEEN.zip", "cover.png"]);
    expect(lot).toMatchObject({ audio: 1, covers: 1, ignored: 0 });
  });
  it("le passage dans la bibliothèque : dedans, en route, ou rien (dossier non réglé)", () => {
    const track = (availability: string) => ({ availability }) as never;
    expect(importedLibraryState({ imported: true, jellyfinId: "jf1", tracks: [] })).toEqual({ kind: "library", jellyfinId: "jf1" });
    expect(importedLibraryState({ imported: true, jellyfinId: null, tracks: [track("cache"), track("pending")] })).toEqual({ kind: "onTheWay" });
    expect(importedLibraryState({ imported: true, jellyfinId: null, tracks: [track("cache")] })).toEqual({ kind: "none" });
    expect(importedLibraryState({ imported: undefined, jellyfinId: "jf1", tracks: [] })).toEqual({ kind: "none" });
  });
});
