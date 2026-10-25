import { describe, expect, it } from "vitest";
import { isListening, listeningLine, sessionOffersMessage } from "./listening";

describe("une écoute dans le tableau de bord des sessions", () => {
  it("la musique et les livres audio sont des écoutes ; un film, un épisode, un clip, non", () => {
    expect(isListening({ type: "Audio" })).toBe(true);
    expect(isListening({ type: "AudioBook" })).toBe(true);
    expect(isListening({ type: "", fromExtension: true })).toBe(true);
    for (const type of ["Movie", "Episode", "MusicVideo", "TvChannel"]) expect(isListening({ type })).toBe(false);
  });

  it("sous le titre : « Artistes · Album », ce qui est connu seulement", () => {
    expect(listeningLine({ type: "Audio", artists: "A, B", album: "Album" })).toBe("A, B · Album");
    expect(listeningLine({ type: "Audio", artists: "A" })).toBe("A");
    expect(listeningLine({ type: "Audio", album: "  " })).toBeNull();
    // Un serveur d'avant `sessions.musicControl` n'envoie ni l'un ni l'autre : rien, comme avant.
    expect(listeningLine({ type: "Audio" })).toBeNull();
    expect(listeningLine({ type: "Movie", artists: "A" })).toBeNull();
  });

  it("« Envoyer un message » : jamais pour une écoute — il n'y a pas d'écran où l'afficher", () => {
    expect(sessionOffersMessage({ type: "Audio" })).toBe(false);
    expect(sessionOffersMessage({ type: "Audio", fromExtension: true })).toBe(false);
    expect(sessionOffersMessage({ type: "Movie" })).toBe(true);
    expect(sessionOffersMessage(null)).toBe(true);
  });
});
