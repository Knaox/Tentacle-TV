import { describe, expect, it } from "vitest";
import {
  isImportableAudio,
  readReleaseRefusal,
  recognizeBandcampUrl,
  releaseJobFraction,
  remainingChunks,
  sharedReleaseLink,
} from "./musicReleaseImport";
import { readPluginMusicManifest } from "./pluginMusicContract";

describe("liens Bandcamp", () => {
  it("reconnaît un album et un titre, sans requête ni ancre", () => {
    expect(recognizeBandcampUrl("https://bastienbecker.bandcamp.com/album/edition-speciale?from=fanpub#x")).toBe("https://bastienbecker.bandcamp.com/album/edition-speciale");
    expect(recognizeBandcampUrl("http://Artiste.Bandcamp.com/track/un-titre/")).toBe("https://artiste.bandcamp.com/track/un-titre");
  });
  it("refuse tout le reste", () => {
    for (const bad of ["https://bandcamp.com.evil.io/album/x", "https://artiste.bandcamp.com/", "https://artiste.bandcamp.com/music", "ftp://a.bandcamp.com/album/x", "pas un lien", ""]) {
      expect(recognizeBandcampUrl(bad)).toBeNull();
    }
  });
  it("trouve le lien dans un texte partagé", () => {
    expect(sharedReleaseLink("Écoute « Édition spéciale » https://bastienbecker.bandcamp.com/album/edition-speciale.")).toBe("https://bastienbecker.bandcamp.com/album/edition-speciale");
    expect(sharedReleaseLink("https://open.spotify.com/playlist/abc")).toBeNull();
    expect(sharedReleaseLink(null)).toBeNull();
  });
});

describe("fichiers et morceaux", () => {
  it("accepte l'audio par type ou par extension", () => {
    expect(isImportableAudio("x.FLAC", "")).toBe(true);
    expect(isImportableAudio("x.bin", "audio/mpeg")).toBe(true);
    expect(isImportableAudio("pochette.jpg", "image/jpeg")).toBe(false);
  });
  it("reprend où le serveur s'est arrêté", () => {
    expect(remainingChunks(10, 0, 4)).toEqual([{ start: 0, end: 4 }, { start: 4, end: 8 }, { start: 8, end: 10 }]);
    expect(remainingChunks(10, 8, 4)).toEqual([{ start: 8, end: 10 }]);
    expect(remainingChunks(10, 10, 4)).toEqual([]);
    expect(remainingChunks(0, 0, 4)).toEqual([]);
  });
  it("avance de 0 à 1 sans jamais finir avant la fin", () => {
    const files = [{ uploadId: "a", name: "a", size: 100, received: 50, state: "receiving" as const }];
    expect(releaseJobFraction({ state: "receiving", files })).toBeCloseTo(0.45);
    expect(releaseJobFraction({ state: "reading", files: [{ ...files[0], received: 100 }] })).toBeCloseTo(0.95);
    expect(releaseJobFraction({ state: "done", files })).toBe(1);
  });
  it("un refus inconnu devient « failed »", () => {
    expect(readReleaseRefusal("budget")).toBe("budget");
    expect(readReleaseRefusal("autre")).toBe("failed");
  });
});

describe("manifeste", () => {
  it("lit `releases` et `releaseSources` (liste fermée)", () => {
    const m = readPluginMusicManifest({ search: "/s", resolve: "/r", releases: "/music/releases", releaseSources: ["files", "soundcloud", "bandcamp"] });
    expect(m?.releases).toBe("/music/releases");
    expect(m?.releaseSources).toEqual(["bandcamp", "files"]);
  });
  it("une extension d'avant ne déclare rien", () => {
    const m = readPluginMusicManifest({ search: "/s", resolve: "/r" });
    expect(m?.releases).toBeUndefined();
    expect(m?.releaseSources).toBeUndefined();
  });
});
