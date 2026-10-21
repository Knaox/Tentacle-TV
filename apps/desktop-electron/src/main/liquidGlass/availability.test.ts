import { describe, expect, it, vi } from "vitest";
import { decideLiquidGlass, osSupportsGlass, type RuntimeProbe } from "./availability";

const tahoe = (probe: RuntimeProbe = "ok", forced?: string) => ({
  platform: "darwin",
  systemVersion: "26.6.2",
  forced,
  probe: () => probe,
});

describe("decideLiquidGlass", () => {
  it("macOS 26, classe présente, pont chargé : le verre natif", () => {
    expect(decideLiquidGlass(tahoe())).toBe("native");
  });

  it("hors macOS, jamais — et la sonde n'est même pas appelée (le pont planterait)", () => {
    const probe = vi.fn((): RuntimeProbe => "ok");
    expect(decideLiquidGlass({ platform: "win32", systemVersion: "10.0.26100", forced: "native", probe })).toBe("not-macos");
    expect(decideLiquidGlass({ platform: "linux", systemVersion: "6.8.0", forced: undefined, probe })).toBe("not-macos");
    expect(probe).not.toHaveBeenCalled();
  });

  it("un macOS d'avant 26 n'a pas l'option — sans charger le pont", () => {
    const probe = vi.fn((): RuntimeProbe => "ok");
    expect(decideLiquidGlass({ platform: "darwin", systemVersion: "15.7.1", forced: undefined, probe })).toBe("unsupported-os");
    expect(probe).not.toHaveBeenCalled();
  });

  it("la version ne suffit pas : sans la classe à l'exécution, pas de verre", () => {
    expect(decideLiquidGlass(tahoe("missing-class"))).toBe("missing-class");
    expect(decideLiquidGlass(tahoe("load-failed"))).toBe("load-failed");
  });

  it("TENTACLE_LIQUID_GLASS=off simule un macOS sans verre, sur macOS 26 même", () => {
    const probe = vi.fn((): RuntimeProbe => "ok");
    expect(decideLiquidGlass({ ...tahoe(), forced: "off", probe })).toBe("forced-off");
    expect(decideLiquidGlass({ ...tahoe(), forced: " OFF ", probe })).toBe("forced-off");
    expect(probe).not.toHaveBeenCalled();
  });

  it("`native` saute la garde de version, jamais celle de la classe", () => {
    const old = { platform: "darwin", systemVersion: "15.7.1", forced: "native" };
    expect(decideLiquidGlass({ ...old, probe: () => "ok" })).toBe("native");
    expect(decideLiquidGlass({ ...old, probe: () => "missing-class" })).toBe("missing-class");
  });

  it("une valeur de forçage inconnue ne décide de rien", () => {
    expect(decideLiquidGlass(tahoe("ok", "metal"))).toBe("native");
    expect(decideLiquidGlass({ ...tahoe("ok", "metal"), systemVersion: "14.0" })).toBe("unsupported-os");
  });
});

describe("osSupportsGlass", () => {
  it("26 et au-delà", () => {
    expect(osSupportsGlass("26.0")).toBe(true);
    expect(osSupportsGlass("26.6.2")).toBe(true);
    expect(osSupportsGlass("27.1")).toBe(true);
  });

  it("16.x : Tahoe vu par un binaire d'un SDK plus ancien", () => {
    expect(osSupportsGlass("16.0")).toBe(true);
  });

  it("refuse le reste, et ce qui ne se lit pas", () => {
    expect(osSupportsGlass("15.7.1")).toBe(false);
    expect(osSupportsGlass("10.16")).toBe(false);
    expect(osSupportsGlass("")).toBe(false);
    expect(osSupportsGlass("abc")).toBe(false);
  });
});
