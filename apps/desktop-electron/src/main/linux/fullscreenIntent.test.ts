import { describe, expect, it } from "vitest";
import { effectiveFullscreen, INTENT_TTL_MS, settleIntent } from "./fullscreenIntent";

describe("plein écran demandé (Linux)", () => {
  it("sans demande en vol, la fenêtre fait foi", () => {
    expect(effectiveFullscreen(null, true, 0)).toBe(true);
    expect(effectiveFullscreen(null, false, 0)).toBe(false);
  });

  it("une demande en vol l'emporte sur une fenêtre pas encore acquittée", () => {
    const intent = { target: true, at: 1000 };
    expect(effectiveFullscreen(intent, false, 1100)).toBe(true);
  });

  it("une demande restée sans réponse est tenue pour refusée", () => {
    const intent = { target: true, at: 1000 };
    expect(effectiveFullscreen(intent, false, 1000 + INTENT_TTL_MS + 1)).toBe(false);
  });

  it("seul l'évènement qui va dans le sens demandé solde la demande", () => {
    const entering = { target: true, at: 0 };
    // Montage Wayland forcé : un `leave` peut précéder l'`enter` réaffirmé.
    expect(settleIntent(entering, false)).toBe(entering);
    expect(settleIntent(entering, true)).toBeNull();
    expect(settleIntent({ target: false, at: 0 }, false)).toBeNull();
    expect(settleIntent(null, true)).toBeNull();
  });
});
