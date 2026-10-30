import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectiveThemeMode } from "./colorScheme";

/**
 * L'apparence d'Octave, à part de celle de Tentacle (Damien, 26/10) : le thème d'Octave ne vaut que quand Octave
 * est affiché ; « Liquid Glass dans Octave » est allumé d'office (lot « fl »), quel que soit celui de Tentacle.
 */

describe("thème d'Octave seul", () => {
  it("Octave affiché, avec son thème : le sien ; « Comme Tentacle » : celui de Tentacle", () => {
    expect(effectiveThemeMode("octave", "dark", "light")).toBe("light");
    expect(effectiveThemeMode("octave", "auto", "same")).toBe("auto");
  });

  it("Tentacle affiché : toujours le thème de Tentacle, quel que soit celui d'Octave", () => {
    expect(effectiveThemeMode("tentacle", "dark", "light")).toBe("dark");
    expect(effectiveThemeMode("tentacle", "light", "dark")).toBe("light");
  });
});

describe("Liquid Glass dans Octave : réglage de l'appareil", () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
      clear: () => map.clear(),
    });
    vi.resetModules();
  });

  it("au premier lancement : allumé, même Tentacle coupé, sans rien écrire", async () => {
    localStorage.setItem("tentacle_liquid_glass", "false");
    const store = await import("./octaveAppearance");
    expect(store.getOctaveLiquidGlass()).toBe(true);
    expect(localStorage.getItem("tentacle_octave_liquid_glass")).toBeNull();
  });

  it("un choix déjà gardé (coupé) reste le sien", async () => {
    localStorage.setItem("tentacle_octave_liquid_glass", "false");
    const store = await import("./octaveAppearance");
    expect(store.getOctaveLiquidGlass()).toBe(false);
  });

  it("ensuite indépendant : Tentacle change, Octave garde le sien (et l'inverse)", async () => {
    localStorage.setItem("tentacle_liquid_glass", "true");
    localStorage.setItem("tentacle_octave_liquid_glass", "false");
    const store = await import("./octaveAppearance");
    expect(store.getOctaveLiquidGlass()).toBe(false);
    store.setOctaveLiquidGlass(true);
    expect(localStorage.getItem("tentacle_liquid_glass")).toBe("true");
    expect(localStorage.getItem("tentacle_octave_liquid_glass")).toBe("true");
  });

  it("thème inconnu ou absent : comme Tentacle", async () => {
    localStorage.setItem("tentacle_octave_theme", "violet");
    const store = await import("./octaveAppearance");
    expect(store.getOctaveTheme()).toBe("same");
    expect(store.sanitizeOctaveTheme("dark")).toBe("dark");
  });
});
