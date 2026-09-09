import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le masque de chaque fenêtre simulée, et l'historique des écritures.
 *
 * Le pont Objective-C est remplacé : `objc.ts` charge koffi, qui n'a rien à
 * faire dans un test — et ce qu'on vérifie ici n'est pas AppKit, c'est la
 * DÉCISION d'écrire ou non.
 */
const masks = new Map<unknown, number>();
const writes: Array<{ window: unknown; mask: number }> = [];

vi.mock("./native", () => ({ trace: (): void => {} }));
vi.mock("./objc", () => ({
  FULLSCREEN_MASK: 1 << 14,
  msg: {
    count: (target: unknown) => masks.get(target) ?? 0,
    setStyleMask: (window: unknown, mask: number) => {
      masks.set(window, mask);
      writes.push({ window, mask });
    },
    setFlag: (): void => {},
    setInt: (): void => {},
    index: (): unknown => ({}),
  },
}));

import { SETTLE_MS, type SeamTarget, createSeam } from "./macosSeam";

/** Le masque relevé sur une fenêtre de mpv ordinaire — `macosChildWindow.ts`. */
const TITLED = 32783;
/** Celui d'une fenêtre à qui macOS a donné son propre espace — `masque=49159`. */
const PROMOTED = 49159;
const NO_DECORATION = 0;

/**
 * La cible telle que la surface la donne : une FONCTION relue à l'échéance, pas
 * une valeur figée à la demande.
 */
let target: SeamTarget | null = null;
const seam = () => createSeam(() => target);
const aim = (window: unknown, fullscreen: boolean) => {
  target = { window, fullscreen };
};

beforeEach(() => {
  vi.useFakeTimers();
  masks.clear();
  writes.length = 0;
  target = null;
});
afterEach(() => vi.useRealTimers());

describe("createSeam", () => {
  it("ne touche JAMAIS une fenêtre que macOS tient en plein écran", () => {
    // Le crash de la 1.21.0 : écrire `borderless` efface le bit
    // `NSWindowStyleMaskFullScreen`, et `-[NSWindow setStyleMask:]` lève — une
    // exception Objective-C que rien, côté JavaScript, ne rattrape.
    const window = {};
    masks.set(window, PROMOTED);
    aim(window, true);
    seam().schedule();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(writes).toEqual([]);
  });

  it("retire le cadre en plein écran, et le rend en sortant", () => {
    const window = {};
    masks.set(window, TITLED);
    const liseré = seam();
    aim(window, true);
    liseré.schedule();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(masks.get(window)).toBe(NO_DECORATION);

    aim(window, false);
    liseré.schedule();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(masks.get(window)).toBe(TITLED);
  });

  it("n'écrit rien avant que AppKit ait eu le temps de se poser", () => {
    const window = {};
    masks.set(window, TITLED);
    aim(window, true);
    seam().schedule();
    vi.advanceTimersByTime(SETTLE_MS - 1);
    expect(writes).toEqual([]);
  });

  it("réarme au lieu d'empiler : deux bascules rapprochées n'écrivent qu'une fois", () => {
    // Electron n'expose aucun évènement de DÉBUT de transition : sans le
    // réarmement, la première demande partirait au milieu de la seconde
    // animation — exactement l'instant qui fait lever AppKit.
    const window = {};
    masks.set(window, TITLED);
    aim(window, true);
    const liseré = seam();
    liseré.schedule();
    vi.advanceTimersByTime(SETTLE_MS - 1);
    liseré.schedule();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(writes).toHaveLength(1);
  });

  it("oublie une demande en attente quand la lecture s'arrête", () => {
    const window = {};
    masks.set(window, TITLED);
    aim(window, true);
    const liseré = seam();
    liseré.schedule();
    liseré.forget();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(writes).toEqual([]);
  });

  it("ne pose rien quand la fenêtre a disparu entre la demande et son échéance", () => {
    seam().schedule();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(writes).toEqual([]);
  });

  it("ne rend pas à une AUTRE fenêtre le masque relevé sur la première", () => {
    // Le défaut que le `let` de module rendait possible : une fenêtre de mpv ne
    // survit pas à sa lecture, la suivante n'est pas le même objet.
    const first = {};
    const second = {};
    masks.set(first, TITLED);
    masks.set(second, NO_DECORATION);
    const liseré = seam();
    aim(first, true);
    liseré.schedule();
    vi.advanceTimersByTime(SETTLE_MS);
    writes.length = 0;

    aim(second, false);
    liseré.schedule();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(writes).toEqual([]);
  });
});
