import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CENTER_ORIGIN, MATERIALIZE, MATERIALIZE_SETTLE_MS, MATERIALIZE_ENTER_EASE, MATERIALIZE_EXIT_EASE, MATERIALIZE_POPOVER, MATERIALIZE_REDUCED,
  materializeStyle, nativeMaterialize,
} from "./playerGlassMaterialize";
import { popoverOriginOf } from "./popoverOrigin";

/**
 * La matérialisation (lot lg8) : UNE source pour la coquille et pour la page. Ce
 * que l'une reçoit, l'autre le joue — mêmes nombres, mêmes courbes.
 */
describe("le geste d'apparition", () => {
  it("la sortie est plus rapide que l'entrée, et sans décalage", () => {
    for (const motion of [MATERIALIZE, MATERIALIZE_POPOVER, MATERIALIZE_REDUCED]) expect(motion.exitMs).toBeLessThan(motion.enterMs);
    expect(nativeMaterialize(MATERIALIZE, 3, CENTER_ORIGIN).delay).toBe(MATERIALIZE_SETTLE_MS + 90);
  });

  it("quelques points seulement : une forme se condense, elle ne pousse pas d'une goutte", () => {
    expect(MATERIALIZE.rise).toBeGreaterThan(0);
    expect(MATERIALIZE.rise).toBeLessThanOrEqual(8);
    expect(MATERIALIZE.scale).toBeGreaterThanOrEqual(0.94);
    // Décalage total discret : six formes paraissent en moins d'un dixième de seconde d'écart.
    expect(MATERIALIZE.staggerMs * 3).toBeLessThanOrEqual(100);
  });

  it("courbes rabotées à [0, 1] (l'animateur d'AppKit n'en joue pas d'autres) ; l'entrée décélère, la sortie accélère", () => {
    for (const ease of [MATERIALIZE_ENTER_EASE, MATERIALIZE_EXIT_EASE]) for (const v of ease) expect(v >= 0 && v <= 1).toBe(true);
    expect(MATERIALIZE_ENTER_EASE[1]).toBeGreaterThan(MATERIALIZE_ENTER_EASE[0]);
    expect(MATERIALIZE_EXIT_EASE[1]).toBe(0);
  });

  it("mouvement réduit : un fondu simple — ni montée, ni échelle, ni décalage (le départ commun seul)", () => {
    const reduced = nativeMaterialize(MATERIALIZE_REDUCED, 5, CENTER_ORIGIN);
    expect(reduced).toMatchObject({ rise: 0, scale: 1, delay: MATERIALIZE_SETTLE_MS });
  });

  it("la page reçoit EXACTEMENT les nombres de la coquille", () => {
    const native = nativeMaterialize(MATERIALIZE, 2, { x: 0.25, y: 1 });
    expect(materializeStyle(native, MATERIALIZE.enterMs)).toEqual({
      "--lgp-mat-rise": "6px",
      "--lgp-mat-scale": "0.96",
      "--lgp-mat-origin": "25% 100%",
      "--lgp-mat-delay": "80ms",
      "--lgp-mat-enter-ms": "340ms",
      "--lgp-mat-exit-ms": "180ms",
      "--lgp-mat-enter-ease": "cubic-bezier(0.2, 0.9, 0.3, 1)",
      "--lgp-mat-exit-ease": "cubic-bezier(0.4, 0, 1, 1)",
    });
  });

  it("une origine folle ou hors de la forme est ramenée dans [0, 1] (la coquille la refuserait)", () => {
    expect(nativeMaterialize(MATERIALIZE, 0, { x: -2, y: Number.NaN })).toMatchObject({ originX: 0, originY: 0.5 });
    expect(nativeMaterialize(MATERIALIZE, -1, { x: 9, y: 1 })).toMatchObject({ originX: 1, delay: MATERIALIZE_SETTLE_MS });
  });
});

describe("un popover naît du centre de son bouton", () => {
  it("origine comptée depuis le bord DROIT du dock (là où le panneau est calé)", () => {
    const o = popoverOriginOf({ right: 1000 }, { left: 900, width: 40 }, 320);
    expect(o.originCss).toBe("calc(100% - 80px) 100%");
    expect(o.origin.x).toBeCloseTo(0.75);
    expect(o.origin.y).toBe(1);
  });

  it("bouton plus loin que la largeur du panneau : le coin bas-gauche ; panneau sans largeur : le bas-droit", () => {
    expect(popoverOriginOf({ right: 1000 }, { left: 300, width: 40 }, 320).origin.x).toBe(0);
    expect(popoverOriginOf({ right: 1000 }, { left: 900, width: 40 }, 0).origin.x).toBe(1);
  });
});

describe("la feuille de la matérialisation", () => {
  const css = readFileSync(new URL("./playerGlassMaterialize.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("n'anime que `transform` et `opacity` (rien qui repeigne à chaque image)", () => {
    const animated = [...css.matchAll(/transition:\s*([^;]+);/g)].flatMap((m) =>
      (m[1] ?? "").split(",").map((part) => part.trim().split(/\s+/)[0]));
    expect(animated.length).toBeGreaterThan(0);
    expect(new Set(animated)).toEqual(new Set(["opacity", "transform"]));
  });

  it("ne transforme JAMAIS la surface elle-même (son rectangle est sa région native)", () => {
    expect(css).toMatch(/\.lgp-surface\[data-lgp-materialize\]\s*\{[^}]*transform:\s*none/);
    // Toute règle qui pose un `translateY` vise un enfant direct ou un pseudo-élément.
    for (const [, selector] of css.replace("@starting-style {", "").matchAll(/([^{}]+)\{[^}]*translateY/g)) {
      for (const part of (selector ?? "").split(/,\s*\n/).map((p) => p.trim()).filter(Boolean)) expect(part).toMatch(/(> \*|::before|::after)$/);
    }
  });
});
