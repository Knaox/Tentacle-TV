import { describe, expect, it } from "vitest";

import {
  PROBE_GAP,
  PROBE_GAP_BELOW,
  PROBE_SIDES,
  PROBE_THICKNESS,
  heldSurfaceTone,
  medianLuminance,
  surfaceProbeRect,
  surfaceToneMeasured,
} from "./surfaceTone";

/**
 * Le ton TENU d'une grande surface : lu sur la couronne autour d'elle (la
 * capture verrait le verre lui-même), une fois, puis gardé.
 */

const VIEW = { width: 1440, height: 900 };
const MENU = { x: 1100, y: 80, width: 300, height: 400 };

describe("la couronne", () => {
  it("quatre bandes hors de la surface, jamais dessus", () => {
    for (const side of PROBE_SIDES) {
      const r = surfaceProbeRect(MENU, side, VIEW)!;
      const overlaps =
        r.x < MENU.x + MENU.width && r.x + r.width > MENU.x && r.y < MENU.y + MENU.height && r.y + r.height > MENU.y;
      expect(overlaps, side).toBe(false);
    }
  });

  it("au-delà de l'ombre : un écart sur les côtés, plus grand dessous", () => {
    expect(surfaceProbeRect(MENU, "left", VIEW)).toEqual({ x: MENU.x - PROBE_GAP - PROBE_THICKNESS, y: 80, width: PROBE_THICKNESS, height: 400 });
    expect(surfaceProbeRect(MENU, "bottom", VIEW)!.y).toBe(MENU.y + MENU.height + PROBE_GAP_BELOW);
    expect(PROBE_GAP_BELOW).toBeGreaterThan(PROBE_GAP);
  });

  it("coupée à la fenêtre : un menu collé au bord droit perd sa bande de droite", () => {
    const edge = { x: 1400, y: 80, width: 40, height: 400 };
    expect(surfaceProbeRect(edge, "right", VIEW)).toBeNull();
    const top = { x: 100, y: 10, width: 200, height: 100 };
    expect(surfaceProbeRect(top, "top", VIEW)).toBeNull();
  });
});

describe("le ton tenu", () => {
  it("médiane : la barre sombre d'où pend un menu ne décide pas seule", () => {
    expect(medianLuminance([0.02, 0.8, 0.85])).toBe(0.8);
    expect(heldSurfaceTone("dark", [0.02, 0.8, 0.85])).toBe("light");
    expect(medianLuminance([0.1, 0.5])).toBeCloseTo(0.3);
  });

  it("un dessous moyen garde le ton du thème (hystérésis des contrôles)", () => {
    expect(heldSurfaceTone("dark", [0.22])).toBe("dark");
    expect(heldSurfaceTone("light", [0.22])).toBe("light");
  });

  it("sans mesure : le ton supposé", () => {
    expect(medianLuminance([])).toBeNull();
    expect(heldSurfaceTone("light", [])).toBe("light");
    expect(heldSurfaceTone("dark", [Number.NaN])).toBe("dark");
  });
});

describe("accessibilité du système", () => {
  it("« Réduire la transparence » et « Contraste accru » : aucun ton mesuré, celui du thème", () => {
    expect(surfaceToneMeasured("liquid")).toBe(true);
    expect(surfaceToneMeasured("frosted")).toBe(false);
    expect(surfaceToneMeasured("solid")).toBe(false);
  });
});
