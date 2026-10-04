import { describe, expect, it } from "vitest";
import { createTranslator, dragPhaseOf, holdPhaseOf } from "./translate";
import { BASE_REMOTE_HINTS } from "./bindings/hints";
import type { RemoteBindings } from "./bindings/types";
import type { RemoteSignal } from "./signals";

/**
 * La traduction est commune à toutes les tables. On l'éprouve ici sur une
 * table d'ESSAI, faite comme le serait celle d'une plateforme qui annonce
 * l'enfoncement ET le relâchement et qui répète l'appui tenu (Android TV) :
 * c'est ce qui prouve que le format suffit à une autre télécommande que la
 * Siri Remote, sans toucher aux comportements.
 */
const TABLE: RemoteBindings = {
  platform: "essai",
  remote: "télécommande d'essai",
  presses: [
    { signal: "DPAD_UP", intent: { type: "move", direction: "haut" }, on: ["down"] },
    { signal: "DPAD_CENTER", intent: { type: "select" }, on: ["down"] },
    { signal: "BACK", intent: { type: "retour" }, on: ["up"] },
    { signal: "MEDIA_FAST_FORWARD", intent: { type: "transport", command: "avance" } },
  ],
  holds: [{ signal: "LONG_CENTER", key: "select" }],
  swipes: [{ signal: "FLICK_LEFT", direction: "gauche" }],
  drags: [{ signal: "TOUCH" }],
  noise: [{ signal: "FOCUS", reason: "essai" }],
  system: [],
  traits: {
    focusMovesBeforeIntent: true, pressOnRelease: false, announcedHolds: false, holdThresholdMs: null,
    backDecidedAhead: false, touchSurface: false, dragOnDemand: false, dragUnit: null, playPauseKey: "always",
  },
  hints: BASE_REMOTE_HINTS,
};

const signal = (name: string, phase: RemoteSignal["phase"], extra: Partial<RemoteSignal> = {}): RemoteSignal => ({
  name, phase, at: 42, ...extra,
});

describe("createTranslator", () => {
  const translator = createTranslator(TABLE);
  const intentOf = (s: RemoteSignal) => translator.translate(s)?.intent ?? null;

  it("ne garde d'un appui que la phase que la table choisit", () => {
    expect(intentOf(signal("DPAD_UP", "down"))).toEqual({ type: "move", direction: "haut" });
    expect(intentOf(signal("DPAD_UP", "up"))).toBeNull();
    expect(intentOf(signal("DPAD_UP", null))).toBeNull();
    expect(intentOf(signal("BACK", "down"))).toBeNull();
    expect(intentOf(signal("BACK", "up"))).toEqual({ type: "retour" });
  });

  it("porte la répétition d'une touche tenue sur un pas et sur OK, pas ailleurs", () => {
    expect(intentOf(signal("DPAD_UP", "down", { repeat: true }))).toEqual({ type: "move", direction: "haut", repeat: true });
    expect(intentOf(signal("DPAD_CENTER", "down", { repeat: true }))).toEqual({ type: "select", repeat: true });
    expect(intentOf(signal("MEDIA_FAST_FORWARD", "down", { repeat: true }))).toEqual({ type: "transport", command: "avance" });
  });

  it("rend une copie : l'intention de la table ne se modifie jamais", () => {
    const first = intentOf(signal("DPAD_UP", "down"));
    if (first?.type === "move") first.direction = "bas";
    expect(intentOf(signal("DPAD_UP", "down"))).toEqual({ type: "move", direction: "haut" });
  });

  it("traduit un maintien, un glisser rapide et un glisser continu", () => {
    expect(intentOf(signal("LONG_CENTER", "down"))).toEqual({ type: "hold", key: "select", phase: "start" });
    expect(intentOf(signal("FLICK_LEFT", null))).toEqual({ type: "swipe", direction: "gauche" });
    expect(intentOf(signal("TOUCH", "change", { motion: { x: 4, y: 5, vx: 6, vy: 7 } }))).toEqual({
      type: "drag", phase: "move", x: 4, y: 5, vx: 6, vy: 7,
    });
  });

  it("ne fait rien d'un glisser continu sans mesures ni phase", () => {
    expect(intentOf(signal("TOUCH", "change"))).toBeNull();
    expect(intentOf(signal("TOUCH", null, { motion: { x: 0, y: 0, vx: 0, vy: 0 } }))).toBeNull();
  });

  it("date l'intention et garde son signal", () => {
    const source = signal("DPAD_CENTER", "down");
    expect(translator.translate(source)).toEqual({ intent: { type: "select" }, at: 42, signal: source });
  });

  it("distingue le bruit déclaré de l'inconnu, sans rendre d'intention pour l'un ni l'autre", () => {
    expect(intentOf(signal("FOCUS", null))).toBeNull();
    expect(translator.knows("FOCUS")).toBe(true);
    expect(intentOf(signal("VOLUME_UP", "down"))).toBeNull();
    expect(translator.knows("VOLUME_UP")).toBe(false);
  });

  it("refuse une table où un signal est lié deux fois", () => {
    const doubled: RemoteBindings = { ...TABLE, holds: [...TABLE.holds, { signal: "DPAD_UP", key: "haut" }] };
    expect(() => createTranslator(doubled)).toThrow(/DPAD_UP/);
  });
});

describe("phases", () => {
  it("d'un maintien : enfoncé → début, relâché → fin, le reste → il dure", () => {
    expect(holdPhaseOf("down")).toBe("start");
    expect(holdPhaseOf("up")).toBe("end");
    expect(holdPhaseOf("change")).toBe("update");
    expect(holdPhaseOf(null)).toBe("update");
  });

  it("d'un glisser : posé, déplacé, levé ; sans phase, pas de geste", () => {
    expect(dragPhaseOf("down")).toBe("start");
    expect(dragPhaseOf("change")).toBe("move");
    expect(dragPhaseOf("up")).toBe("end");
    expect(dragPhaseOf(null)).toBeNull();
  });
});
