import { describe, expect, it } from "vitest";
import { nextColdStartPhase } from "./useRecoPageModel";

const cold = { state: "cold", tmdbConfigured: true };

describe("nextColdStartPhase", () => {
  it("impose la grille une fois, à froid, sans accusé", () => {
    expect(nextColdStartPhase("auto", cold, false)).toBe("hold");
  });
  it("ne l'impose pas avec un accusé ni sans clé TMDB", () => {
    expect(nextColdStartPhase("auto", cold, true)).toBe("auto");
    expect(nextColdStartPhase("auto", { state: "cold", tmdbConfigured: false }, false)).toBe("auto");
  });
  it("reste collante, et « dismissed » survit tant que le serveur dit cold", () => {
    expect(nextColdStartPhase("hold", cold, true)).toBe("hold");
    expect(nextColdStartPhase("dismissed", cold, false)).toBe("dismissed");
  });
  it("se réarme dès que le profil a tourné", () => {
    expect(nextColdStartPhase("dismissed", { state: "ready", tmdbConfigured: true }, true)).toBe("auto");
    expect(nextColdStartPhase("hold", undefined, false)).toBe("auto");
  });
});
