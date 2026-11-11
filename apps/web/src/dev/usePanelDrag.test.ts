import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le bureau macOS dessine son bandeau de fenêtre dans la page : 38 points, au-dessus de tout.
vi.mock("../desktop/hostChrome", () => ({ hostTitleBarHeight: () => 38 }));

const { clampToWindow } = await import("./usePanelDrag");

describe("le panneau de débogage reste dans la fenêtre, sous le bandeau de fenêtre", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posé en haut à gauche, il naît sous le bandeau : son en-tête reste saisissable", () => {
    expect(clampToWindow({ x: 16, y: 16 }, 460, 760)).toEqual({ x: 16, y: 46 });
  });

  it("glissé vers le haut, il s'arrête au bandeau", () => {
    expect(clampToWindow({ x: 300, y: -40 }, 460, 400).y).toBe(46);
  });

  it("il ne sort ni par la droite ni par le bas", () => {
    expect(clampToWindow({ x: 5000, y: 5000 }, 460, 400)).toEqual({ x: 1440 - 460 - 8, y: 900 - 400 - 8 });
  });

  it("plus haut que la fenêtre, il garde son en-tête à l'écran plutôt que son pied", () => {
    expect(clampToWindow({ x: 16, y: 200 }, 460, 2000).y).toBe(46);
  });
});
