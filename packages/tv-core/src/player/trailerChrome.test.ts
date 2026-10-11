import { describe, expect, it } from "vitest";
import {
  TRAILER_CLOSE_KEY,
  TRAILER_IDLE_MS,
  TRAILER_UNAVAILABLE_RETURN_MS,
  trailerChromeShown,
  trailerLeavesAfter,
  trailerState,
} from "./trailerChrome";

describe("l'écran de bande-annonce", () => {
  it("la croix est la seule cible, donc l'entrée", () => {
    expect(TRAILER_CLOSE_KEY).toBe("trailer:close");
  });

  it("indisponible sans rien à lire ou après un échec ; lecture à la première image ; sinon chargement", () => {
    expect(trailerState({ canPlay: false, failed: false, loaded: false })).toBe("unavailable");
    expect(trailerState({ canPlay: true, failed: true, loaded: true })).toBe("unavailable");
    expect(trailerState({ canPlay: true, failed: false, loaded: true })).toBe("playing");
    expect(trailerState({ canPlay: true, failed: false, loaded: false })).toBe("loading");
  });
});

describe("le chrome au repos", () => {
  it("s'estompe trois secondes après le dernier geste (les contrôles : `trailerControls.test.ts`)", () => {
    expect(TRAILER_IDLE_MS).toBe(3000);
  });
});

describe("indisponible", () => {
  it("rend la fiche après quatre secondes, seulement devant", () => {
    expect(trailerLeavesAfter("unavailable", true)).toBe(TRAILER_UNAVAILABLE_RETURN_MS);
    expect(TRAILER_UNAVAILABLE_RETURN_MS).toBe(4000);
    expect(trailerLeavesAfter("unavailable", false)).toBeNull();
    expect(trailerLeavesAfter("playing", true)).toBeNull();
    expect(trailerLeavesAfter("loading", true)).toBeNull();
  });
});

describe("ce qui est à l'écran", () => {
  it("hors lecture : le chrome, toujours ; pas de barre (rien à parcourir)", () => {
    expect(trailerChromeShown("loading", false, false)).toEqual({ chrome: true, timeline: false });
    expect(trailerChromeShown("unavailable", false, false)).toEqual({ chrome: true, timeline: false });
  });

  it("en lecture : le chrome suit les contrôles ; pendant un défilement, la barre reste seule", () => {
    expect(trailerChromeShown("playing", true, false)).toEqual({ chrome: true, timeline: true });
    expect(trailerChromeShown("playing", false, false)).toEqual({ chrome: false, timeline: false });
    expect(trailerChromeShown("playing", false, true)).toEqual({ chrome: false, timeline: true });
  });
});
