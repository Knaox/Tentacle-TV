import { describe, expect, it } from "vitest";
import { canOfferPip, pipAspect, pipSkipDelta, shouldAutoEnterPip } from "./pipPolicy";

const playing = { paused: false, started: true, ended: false, failed: false, remote: false };

describe("image dans l'image : quand y entrer", () => {
  it("une lecture qui avance entre en image dans l'image en quittant l'app", () => {
    expect(shouldAutoEnterPip(playing)).toBe(true);
  });

  it("une lecture en pause reste dans l'app (comme AVKit sur iOS)", () => {
    expect(shouldAutoEnterPip({ ...playing, paused: true })).toBe(false);
  });

  it("jamais avant la première image, sur l'écran de fin ou une erreur", () => {
    expect(shouldAutoEnterPip({ ...playing, started: false })).toBe(false);
    expect(shouldAutoEnterPip({ ...playing, ended: true })).toBe(false);
    expect(shouldAutoEnterPip({ ...playing, failed: true })).toBe(false);
  });

  it("jamais quand l'image est sur une TV (AirPlay, Cast)", () => {
    expect(shouldAutoEnterPip({ ...playing, remote: true })).toBe(false);
    expect(canOfferPip({ ...playing, remote: true })).toBe(false);
  });

  it("le bouton reste proposé en pause", () => {
    expect(canOfferPip({ ...playing, paused: true })).toBe(true);
  });
});

describe("image dans l'image : gestes et format", () => {
  it("±10 s, comme les boutons d'AVKit", () => {
    expect(pipSkipDelta("rewind")).toBe(-10);
    expect(pipSkipDelta("forward")).toBe(10);
    expect(pipSkipDelta("play")).toBe(0);
  });

  it("garde le format de l'image, borné à ce qu'Android accepte", () => {
    expect(pipAspect(1920, 1080)).toEqual({ width: 1920, height: 1080 });
    expect(pipAspect(3000, 1000)).toEqual({ width: 239, height: 100 });
    expect(pipAspect(500, 2000)).toEqual({ width: 100, height: 239 });
    expect(pipAspect()).toEqual({ width: 16, height: 9 });
  });
});
