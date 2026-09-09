import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Ce que l'écran simulé rapporte — `maximumPotential…` sous une autre forme. */
let potential = 1;

vi.mock("./native", () => ({ trace: (): void => {} }));
vi.mock("./objc", () => ({
  fromHandle: (): unknown => ({}),
  msg: { get: (): unknown => ({}) },
}));
vi.mock("./macosEdr", () => ({
  readEdr: () => ({
    current: potential,
    potential,
    granted: potential > 1.01,
    capable: potential > 1.01,
  }),
}));

import { adaptToDisplay } from "./macosHdrOptions";

const realPlatform = process.platform;
const asPlatform = (p: string) =>
  Object.defineProperty(process, "platform", { value: p, configurable: true });

/** Un hôte réduit à ce que le module lui demande. */
const host = { getNativeWindowHandle: () => Buffer.alloc(8) } as unknown as Parameters<
  typeof adaptToDisplay
>[1];

const withHint = { vo: "gpu-next", "target-colorspace-hint": "yes" } as const;

beforeEach(() => {
  potential = 1;
  asPlatform("darwin");
});
afterEach(() => {
  Object.defineProperty(process, "platform", { value: realPlatform, configurable: true });
});

describe("adaptToDisplay", () => {
  it("retire la transmission PQ sur un écran sans plage étendue", () => {
    // Aucun Mac Intel n'a d'écran EDR : demander du PQ y fait convertir macOS,
    // hors de tout réglage, au lieu de laisser libplacebo s'en charger.
    expect(adaptToDisplay(withHint, host)).toEqual({ vo: "gpu-next" });
  });

  it("la garde sur un écran qui sait la rendre", () => {
    potential = 8.48;
    expect(adaptToDisplay(withHint, host)).toEqual(withHint);
  });

  it("ne touche à rien hors macOS", () => {
    asPlatform("win32");
    expect(adaptToDisplay(withHint, host)).toEqual(withHint);
  });

  it("n'interroge pas l'écran quand l'option n'a pas été demandée", () => {
    // Le montage Render API la retire déjà (`macosRenderOptions.ts`) : il n'y a
    // alors ni option à juger, ni raison de réveiller AppKit.
    const spy = vi.fn();
    expect(adaptToDisplay({ vo: "libmpv" }, { getNativeWindowHandle: spy } as never)).toEqual({
      vo: "libmpv",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("rend une COPIE, jamais l'objet reçu", () => {
    const source = { ...withHint };
    const out = adaptToDisplay(source, host);
    expect(out).not.toBe(source);
    expect(source["target-colorspace-hint"]).toBe("yes");
  });
});
