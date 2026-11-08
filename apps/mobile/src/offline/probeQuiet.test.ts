import { describe, expect, it } from "vitest";
import { skipPeriodicProbe } from "./probeQuiet";

describe("sonde périodique de connectivité : quand elle se tait", () => {
  it("rien ne joue : elle tourne, en ligne comme hors ligne (comme avant)", () => {
    expect(skipPeriodicProbe({ localPlayback: false, musicPlaying: false, online: true })).toBe(false);
    expect(skipPeriodicProbe({ localPlayback: false, musicPlaying: false, online: false })).toBe(false);
  });

  it("une vidéo gardée joue : elle se tait, même hors ligne (comme avant)", () => {
    expect(skipPeriodicProbe({ localPlayback: true, musicPlaying: false, online: true })).toBe(true);
    expect(skipPeriodicProbe({ localPlayback: true, musicPlaying: false, online: false })).toBe(true);
  });

  it("Octave joue et l'app se sait en ligne : elle se tait (les requêtes d'Octave sondent)", () => {
    expect(skipPeriodicProbe({ localPlayback: false, musicPlaying: true, online: true })).toBe(true);
  });

  it("Octave joue mais l'app est hors ligne : la sonde à 15 s continue, c'est elle qui voit le serveur revenir", () => {
    expect(skipPeriodicProbe({ localPlayback: false, musicPlaying: true, online: false })).toBe(false);
  });
});
