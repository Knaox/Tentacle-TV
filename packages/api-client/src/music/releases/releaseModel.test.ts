import { describe, expect, it } from "vitest";
import { albumHintOf, releaseArtForPixels, isImportableAudio, readReleaseRefusal, releaseFraction, remainingChunks } from "./releaseModel";

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
});
