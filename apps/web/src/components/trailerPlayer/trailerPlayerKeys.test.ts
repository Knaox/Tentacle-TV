import { describe, expect, it } from "vitest";
import { steppedVolume, trailerKeyAction } from "./trailerPlayerKeys";

describe("clavier du lecteur des bandes-annonces", () => {
  it("lecture, sauts de 10 s, volume, muet, plein écran, sous-titres", () => {
    expect(trailerKeyAction({ code: "Space" })).toEqual({ kind: "togglePlay" });
    expect(trailerKeyAction({ code: "KeyK" })).toEqual({ kind: "togglePlay" });
    expect(trailerKeyAction({ code: "ArrowLeft" })).toEqual({ kind: "skip", delta: -10 });
    expect(trailerKeyAction({ code: "KeyL" })).toEqual({ kind: "skip", delta: 10 });
    expect(trailerKeyAction({ code: "ArrowUp" })).toEqual({ kind: "volume", delta: 0.1 });
    expect(trailerKeyAction({ code: "KeyM" })).toEqual({ kind: "toggleMute" });
    expect(trailerKeyAction({ code: "KeyF" })).toEqual({ kind: "toggleFullscreen" });
    expect(trailerKeyAction({ code: "KeyC" })).toEqual({ kind: "toggleSubtitles" });
    expect(trailerKeyAction({ code: "Escape" })).toEqual({ kind: "escape" });
  });

  it("Maj+N et Maj+P changent de bande-annonce ; N seul ne fait rien", () => {
    expect(trailerKeyAction({ code: "KeyN", shiftKey: true })).toEqual({ kind: "neighbor", direction: 1 });
    expect(trailerKeyAction({ code: "KeyP", shiftKey: true })).toEqual({ kind: "neighbor", direction: -1 });
    expect(trailerKeyAction({ code: "KeyN" })).toBeNull();
  });

  it("jamais un raccourci du système", () => {
    expect(trailerKeyAction({ code: "KeyF", metaKey: true })).toBeNull();
    expect(trailerKeyAction({ code: "KeyC", ctrlKey: true })).toBeNull();
  });

  it("le volume reste entre 0 et 1", () => {
    expect(steppedVolume(0.95, 0.1)).toBe(1);
    expect(steppedVolume(0.05, -0.1)).toBe(0);
    expect(steppedVolume(0.5, 0.1)).toBe(0.6);
  });
});
