import { describe, expect, it } from "vitest";
import type { RemoteIntent } from "../remote/intents";
import {
  TRAILER_CHROME_ON_IDLE,
  TRAILER_CLOSE_KEY,
  TRAILER_IDLE_MS,
  TRAILER_UNAVAILABLE_RETURN_MS,
  trailerChromeOnPlaying,
  trailerChromeOnWake,
  trailerLeavesAfter,
  trailerState,
  trailerWakes,
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
  it("s'estompe trois secondes après le début de la lecture, sans geste", () => {
    expect(TRAILER_IDLE_MS).toBe(3000);
    expect(trailerChromeOnPlaying(true)).toEqual({ dimmed: false, timer: "arm" });
    expect(TRAILER_CHROME_ON_IDLE).toEqual({ dimmed: true, timer: "keep" });
  });

  it("ne s'estompe jamais hors lecture", () => {
    expect(trailerChromeOnPlaying(false)).toEqual({ dimmed: false, timer: "cancel" });
    expect(trailerChromeOnWake(false)).toEqual({ dimmed: false, timer: "keep" });
  });

  it("un geste le rallume et relance l'attente", () => {
    expect(trailerChromeOnWake(true)).toEqual({ dimmed: false, timer: "arm" });
  });

  it("tout geste compte — appui, maintien, glisser, doigt sur le pavé —, sauf Retour", () => {
    const wakes: RemoteIntent[] = [
      { type: "move", direction: "bas" },
      { type: "select" },
      { type: "playPause" },
      { type: "hold", key: "select", phase: "start" },
      { type: "swipe", direction: "gauche" },
      { type: "drag", phase: "move", x: 1, y: 2, vx: 0, vy: 0 },
      { type: "page", direction: "haut" },
    ];
    for (const intent of wakes) expect(trailerWakes(intent)).toBe(true);
    expect(trailerWakes({ type: "retour" })).toBe(false);
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
