import { describe, expect, it } from "vitest";

import {
  RAIL_SHORTCUT_TARGETS, marksContentFocus, railBridge, railLeftArmDelay, railShortcutZones, railShortcutsActive,
} from "./railShortcuts";

describe("railShortcuts — les raccourcis du rail", () => {
  it("existent rail focalisé, hors menu et déplacement", () => {
    expect(railShortcutsActive({ railFocused: true, heldKey: null, movingKey: null })).toBe(true);
    expect(railShortcutsActive({ railFocused: false, heldKey: null, movingKey: null })).toBe(false);
    expect(railShortcutsActive({ railFocused: true, heldKey: "Library_a", movingKey: null })).toBe(false);
    expect(railShortcutsActive({ railFocused: true, heldKey: null, movingKey: "Library_a" })).toBe(false);
  });

  it("au-dessus → profil, au-dessous → Rechercher, à gauche → profil", () => {
    expect(RAIL_SHORTCUT_TARGETS).toEqual({ above: "nav:Search", below: "nav:Settings", left: "nav:Settings" });
  });

  it("GAUCHE s'arme après 450 ms, ou 1 100 ms arrivé en rafale (contenu focalisé il y a moins de 350 ms)", () => {
    expect(railLeftArmDelay(1000, 2000)).toBe(450);
    expect(railLeftArmDelay(1000, 1349)).toBe(1100);
    expect(railLeftArmDelay(1000, 1350)).toBe(450);
    expect(marksContentFocus("resume:2")).toBe(true);
    expect(marksContentFocus("nav:Home")).toBe(false);
  });

  it("les zones, sur la géométrie publiée", () => {
    expect(railShortcutZones({ left: 44, expandedWidth: 320, strip: { top: 200, bottom: 700 }, profile: { top: 900, bottom: 1000 } })).toEqual({
      above: { left: 44, width: 320, top: 0, height: 196 },
      below: { left: 44, width: 320, top: 1004, bottom: 0 },
      left: { left: 0, width: 40, top: 0, bottom: 0 },
    });
    expect(railShortcutZones({ left: 44, expandedWidth: 320, strip: { top: 2, bottom: 700 }, profile: { top: 900, bottom: 1000 } }).above.height).toBe(0);
  });
});

describe("railBridge — les ponts entre le rail et le contenu", () => {
  const defaults = { left: 44, expandedWidth: 380 };

  it("rail focalisé : vers la dernière cible de contenu, après le rail ouvert", () => {
    expect(railBridge({ railFocused: true, contentKey: "grid:4", frame: { left: 44, expandedWidth: 312 }, defaults, contentLeft: 200 })).toEqual({
      kind: "exit", target: "grid:4", zone: { left: 368, right: 0, top: 0, bottom: 0 },
    });
  });

  it("géométrie pas encore publiée : la plus grande largeur", () => {
    expect(railBridge({ railFocused: true, contentKey: null, frame: null, defaults, contentLeft: 200 })).toMatchObject({ target: null, zone: { left: 436 } });
  });

  it("contenu focalisé : une bande à gauche du contenu", () => {
    expect(railBridge({ railFocused: false, contentKey: "grid:4", frame: null, defaults, contentLeft: 200 })).toEqual({
      kind: "enter", zone: { left: 0, top: 0, bottom: 0, width: 180 },
    });
  });
});
