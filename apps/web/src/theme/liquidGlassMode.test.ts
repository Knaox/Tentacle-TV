import { afterEach, describe, expect, it, vi } from "vitest";
import { liquidGlassToggleVisible, resolveLiquidGlassMode } from "./liquidGlassMode";

/**
 * Le mode Liquid Glass : `native` sur macOS 26 réglage allumé, `refraction`
 * allumé sans verre natif, `off` coupé — et l'interrupteur qui n'existe sur le
 * bureau macOS que là où le verre natif existe.
 *
 * Les tests du module chargé simulent ce que le preload pose AVANT la page
 * (`window.tentacle`), puis rechargent le module : c'est au chargement, avant
 * le premier rendu, que l'attribut se pose.
 */

describe("resolveLiquidGlassMode", () => {
  it("native seulement réglage allumé ET verre natif supporté", () => {
    expect(resolveLiquidGlassMode({ enabled: true, nativeSupported: true })).toBe("native");
    expect(resolveLiquidGlassMode({ enabled: true, nativeSupported: false })).toBe("refraction");
    expect(resolveLiquidGlassMode({ enabled: false, nativeSupported: true })).toBe("off");
    expect(resolveLiquidGlassMode({ enabled: false, nativeSupported: false })).toBe("off");
  });
});

describe("liquidGlassToggleVisible", () => {
  it("sur le bureau macOS, seulement avec le verre natif", () => {
    expect(liquidGlassToggleVisible({ platform: "macos", nativeSupported: true })).toBe(true);
    expect(liquidGlassToggleVisible({ platform: "macos", nativeSupported: false })).toBe(false);
  });

  it("ailleurs, le comportement d'avant : toujours là", () => {
    for (const platform of ["web", "windows", "linux"] as const) {
      expect(liquidGlassToggleVisible({ platform, nativeSupported: false })).toBe(true);
    }
  });
});

interface FakeBridge {
  supported: boolean;
  setEnabled: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

function fakeBridge(supported: boolean): FakeBridge {
  return { supported, setEnabled: vi.fn(), upsert: vi.fn(), remove: vi.fn() };
}

/** Pose un faux environnement, puis charge le module à neuf. */
async function boot(options: {
  platform?: "darwin" | "win32" | "linux";
  bridge?: FakeBridge;
  stored?: string | null;
}) {
  const attributes = new Map<string, string>();
  const storage = new Map<string, string>();
  if (options.stored != null) storage.set("tentacle_liquid_glass", options.stored);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
  });
  vi.stubGlobal("document", {
    documentElement: { setAttribute: (name: string, value: string) => void attributes.set(name, value) },
  });
  vi.stubGlobal(
    "window",
    options.platform
      ? { tentacle: { platform: options.platform, liquidGlass: options.bridge, capabilities: [] } }
      : {},
  );
  vi.resetModules();
  const mode = await import("./liquidGlassMode");
  const store = await import("./liquidGlass");
  return { mode, store, attribute: () => attributes.get("data-liquid-glass") };
}

describe("le mode posé au chargement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("macOS 26 : native par défaut, et le réglage est dit à la coquille", async () => {
    const bridge = fakeBridge(true);
    const { mode, attribute } = await boot({ platform: "darwin", bridge });
    expect(attribute()).toBe("native");
    expect(mode.getLiquidGlassMode()).toBe("native");
    expect(mode.nativeGlassBridge()).toBe(bridge);
    expect(bridge.setEnabled).toHaveBeenCalledWith(true);
  });

  it("couper le réglage : off, la coquille retire son verre, les abonnés l'apprennent", async () => {
    const bridge = fakeBridge(true);
    const { mode, store, attribute } = await boot({ platform: "darwin", bridge });
    const listener = vi.fn();
    mode.subscribeLiquidGlassMode(listener);
    store.setLiquidGlass(false);
    expect(attribute()).toBe("off");
    expect(bridge.setEnabled).toHaveBeenLastCalledWith(false);
    expect(listener).toHaveBeenCalledTimes(1);
    store.setLiquidGlass(true);
    expect(attribute()).toBe("native");
  });

  it("un réglage coupé AVANT le lancement : off dès le départ", async () => {
    const bridge = fakeBridge(true);
    const { attribute } = await boot({ platform: "darwin", bridge, stored: "false" });
    expect(attribute()).toBe("off");
    expect(bridge.setEnabled).toHaveBeenCalledWith(false);
  });

  it("macOS d'avant 26 (pont non supporté) : refraction, aucun appel natif", async () => {
    const bridge = fakeBridge(false);
    const { mode, attribute } = await boot({ platform: "darwin", bridge });
    expect(attribute()).toBe("refraction");
    expect(mode.nativeGlassBridge()).toBeNull();
    expect(bridge.setEnabled).not.toHaveBeenCalled();
  });

  it("Windows, Linux : refraction, même si un pont s'annonçait", async () => {
    for (const platform of ["win32", "linux"] as const) {
      const bridge = fakeBridge(true);
      const { attribute } = await boot({ platform, bridge });
      expect(attribute()).toBe("refraction");
      expect(bridge.setEnabled).not.toHaveBeenCalled();
    }
  });

  it("le web : refraction, sans pont", async () => {
    const { mode, attribute } = await boot({});
    expect(attribute()).toBe("refraction");
    expect(mode.nativeGlassBridge()).toBeNull();
  });

  it("une coquille qui lève ne casse pas la page", async () => {
    const bridge = fakeBridge(true);
    bridge.setEnabled.mockImplementation(() => {
      throw new Error("pont perdu");
    });
    const { attribute } = await boot({ platform: "darwin", bridge });
    expect(attribute()).toBe("native");
  });
});
