import { describe, expect, it } from "vitest";

import { STARTUP_WINDOWS, nextStartupWindow, startupRouteOf } from "./startupWindows";

describe("les fenêtres du démarrage — un registre ordonné, une à la fois", () => {
  it("le premier passage : le code PIN, puis la barre, puis la photo", () => {
    expect(STARTUP_WINDOWS).toEqual(["pinSetup", "railSetup", "photoSetup"]);
  });

  it("au sortir d'une session : la première fenêtre due, sinon l'accueil", () => {
    expect(nextStartupWindow({ railSetup: true })).toBe("railSetup");
    expect(startupRouteOf(nextStartupWindow({ railSetup: true }))).toBe("RailSetup");
    expect(nextStartupWindow({ railSetup: false })).toBeNull();
    expect(nextStartupWindow({})).toBeNull();
    expect(startupRouteOf(null)).toBe("Home");
  });

  it("toutes dues : le code PIN d'abord", () => {
    const due = { pinSetup: true, railSetup: true, photoSetup: true };
    expect(nextStartupWindow(due)).toBe("pinSetup");
    expect(startupRouteOf(nextStartupWindow(due))).toBe("PinSetup");
  });

  it("chaque fenêtre fermée cède à la suivante due, jamais à une précédente", () => {
    const due = { pinSetup: true, railSetup: true, photoSetup: true };
    expect(nextStartupWindow(due, "pinSetup")).toBe("railSetup");
    expect(nextStartupWindow(due, "railSetup")).toBe("photoSetup");
    expect(startupRouteOf(nextStartupWindow(due, "railSetup"))).toBe("PhotoSetup");
    expect(nextStartupWindow(due, "photoSetup")).toBeNull();
  });

  it("une fenêtre qui n'est pas due est sautée", () => {
    expect(nextStartupWindow({ pinSetup: false, railSetup: false, photoSetup: true })).toBe("photoSetup");
    expect(nextStartupWindow({ pinSetup: true, railSetup: false, photoSetup: true }, "pinSetup")).toBe("photoSetup");
    expect(nextStartupWindow({ pinSetup: true, railSetup: false, photoSetup: false }, "pinSetup")).toBeNull();
  });

  it("une fenêtre fermée ne revient pas : on cherche après elle", () => {
    expect(nextStartupWindow({ railSetup: true }, "railSetup")).toBeNull();
    expect(nextStartupWindow({ pinSetup: true }, "railSetup")).toBeNull();
  });
});
