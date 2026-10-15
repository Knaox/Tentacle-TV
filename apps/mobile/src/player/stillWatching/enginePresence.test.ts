import { describe, expect, it } from "vitest";
import { engineResumeIsPresence } from "./enginePresence";

describe("engineResumeIsPresence", () => {
  it("une reprise que l'écran n'a pas demandée (écran verrouillé, casque) est une présence", () => {
    expect(engineResumeIsPresence(true, false)).toBe(true);
  });

  it("l'écho d'une reprise demandée par l'écran (Reprendre, épisode suivant) n'en est pas une", () => {
    expect(engineResumeIsPresence(false, false)).toBe(false);
  });

  it("une pause venue du moteur (fin du fichier, interruption) n'en est pas une", () => {
    expect(engineResumeIsPresence(false, true)).toBe(false);
  });

  it("l'écho d'une pause demandée n'en est pas une", () => {
    expect(engineResumeIsPresence(true, true)).toBe(false);
  });
});
