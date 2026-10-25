import { describe, expect, it } from "vitest";
import type { AdminNowPlayingDto } from "./dto";
import { refusesMessage } from "./listening";

const playing = (nowPlaying: Partial<AdminNowPlayingDto> | null) => ({
  nowPlaying: nowPlaying === null ? null : { itemId: "i", name: "n", type: "", imageItemId: "", ...nowPlaying },
});

describe("pas de message pour une écoute (refus du serveur)", () => {
  it("musique de la bibliothèque, livre audio, lecture d'extension : refusé", () => {
    expect(refusesMessage(playing({ type: "Audio" }))).toBe(true);
    expect(refusesMessage(playing({ type: "AudioBook" }))).toBe(true);
    expect(refusesMessage(playing({ type: "Audio", fromExtension: true }))).toBe(true);
  });

  it("un film, un épisode, un clip, une session au repos, une session inconnue : le message part", () => {
    for (const type of ["Movie", "Episode", "MusicVideo"]) expect(refusesMessage(playing({ type }))).toBe(false);
    expect(refusesMessage(playing(null))).toBe(false);
    expect(refusesMessage(undefined)).toBe(false);
  });
});
