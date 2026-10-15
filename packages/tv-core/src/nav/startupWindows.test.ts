import { describe, expect, it } from "vitest";

import { STARTUP_WINDOWS, nextStartupWindow, startupRouteOf } from "./startupWindows";

describe("les fenêtres du démarrage — un registre ordonné, une à la fois", () => {
  it("la préconfiguration de la barre ouvre le registre", () => {
    expect(STARTUP_WINDOWS[0]).toBe("railSetup");
  });

  it("au sortir d'une session : la première fenêtre due, sinon l'accueil", () => {
    expect(nextStartupWindow({ railSetup: true })).toBe("railSetup");
    expect(startupRouteOf(nextStartupWindow({ railSetup: true }))).toBe("RailSetup");
    expect(nextStartupWindow({ railSetup: false })).toBeNull();
    expect(nextStartupWindow({})).toBeNull();
    expect(startupRouteOf(null)).toBe("Home");
  });

  it("une fenêtre fermée ne revient pas : on cherche après elle", () => {
    expect(nextStartupWindow({ railSetup: true }, "railSetup")).toBeNull();
  });
});
