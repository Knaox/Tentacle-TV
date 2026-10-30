import { afterEach, describe, expect, it, vi } from "vitest";
import { liquidGlassEnabledFor, liquidGlassToggleVisible, resolveLiquidGlassMode, resolveSurfaceLiquidGlassMode } from "./liquidGlassMode";

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
  it("seulement là où le verre natif existe (bureau, macOS 26)", () => {
    expect(liquidGlassToggleVisible({ nativeSupported: true })).toBe(true);
  });

  // Damien, 26/10 : « l'option Liquid Glass apparaît sur le web — pas logique ».
  it("web, Windows, Linux, macOS d'avant : aucune ligne Liquid Glass", () => {
    expect(liquidGlassToggleVisible({ nativeSupported: false })).toBe(false);
  });
});

describe("la porte suit la surface affichée (deux réglages indépendants)", () => {
  const native = { nativeSupported: true };

  it("Octave sans verre, Tentacle avec", () => {
    expect(resolveSurfaceLiquidGlassMode({ ...native, surface: "octave", tentacle: true, octave: false })).toBe("off");
    expect(resolveSurfaceLiquidGlassMode({ ...native, surface: "tentacle", tentacle: true, octave: false })).toBe("native");
  });

  it("l'inverse : Tentacle sans verre, Octave avec", () => {
    expect(resolveSurfaceLiquidGlassMode({ ...native, surface: "tentacle", tentacle: false, octave: true })).toBe("off");
    expect(resolveSurfaceLiquidGlassMode({ ...native, surface: "octave", tentacle: false, octave: true })).toBe("native");
  });

  it("sans verre natif, le réglage de la surface donne `refraction` ou `off`, comme avant", () => {
    expect(resolveSurfaceLiquidGlassMode({ nativeSupported: false, surface: "octave", tentacle: false, octave: true })).toBe("refraction");
    expect(liquidGlassEnabledFor({ surface: "tentacle", tentacle: false, octave: true })).toBe(false);
  });
});

interface FakeBridge {
  supported: boolean;
  refractsVideo?: boolean;
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

  it("macOS 26, Tentacle : coupé d'office (lot « fl »), la coquille l'apprend", async () => {
    const bridge = fakeBridge(true);
    const { attribute } = await boot({ platform: "darwin", bridge });
    expect(attribute()).toBe("off");
    expect(bridge.setEnabled).toHaveBeenCalledWith(false);
  });

  it("macOS 26, allumé par l'utilisateur : native, et le réglage est dit à la coquille", async () => {
    const bridge = fakeBridge(true);
    const { mode, attribute } = await boot({ platform: "darwin", bridge, stored: "true" });
    expect(attribute()).toBe("native");
    expect(mode.getLiquidGlassMode()).toBe("native");
    expect(mode.nativeGlassBridge()).toBe(bridge);
    expect(bridge.setEnabled).toHaveBeenCalledWith(true);
  });

  it("couper le réglage : off, la coquille retire son verre, les abonnés l'apprennent", async () => {
    const bridge = fakeBridge(true);
    const { mode, store, attribute } = await boot({ platform: "darwin", bridge, stored: "true" });
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

  it("le verre voit la vidéo seulement si le pont le dit (montage fenetre)", async () => {
    const seeing = { ...fakeBridge(true), refractsVideo: true };
    const { mode } = await boot({ platform: "darwin", bridge: seeing });
    expect(mode.nativeGlassRefractsVideo()).toBe(true);
    const blind = await boot({ platform: "darwin", bridge: fakeBridge(true) });
    expect(blind.mode.nativeGlassRefractsVideo()).toBe(false);
    const old = await boot({ platform: "darwin", bridge: { ...fakeBridge(false), refractsVideo: true } });
    expect(old.mode.nativeGlassRefractsVideo()).toBe(false);
  });

  it("macOS d'avant 26 (pont non supporté) : refraction, aucun appel natif", async () => {
    const bridge = fakeBridge(false);
    const { mode, attribute } = await boot({ platform: "darwin", bridge, stored: "true" });
    expect(attribute()).toBe("refraction");
    expect(mode.nativeGlassBridge()).toBeNull();
    expect(bridge.setEnabled).not.toHaveBeenCalled();
  });

  it("Windows, Linux : refraction, même si un pont s'annonçait", async () => {
    for (const platform of ["win32", "linux"] as const) {
      const bridge = fakeBridge(true);
      const { attribute } = await boot({ platform, bridge, stored: "true" });
      expect(attribute()).toBe("refraction");
      expect(bridge.setEnabled).not.toHaveBeenCalled();
    }
  });

  it("le web : refraction, sans pont", async () => {
    const { mode, attribute } = await boot({ stored: "true" });
    expect(attribute()).toBe("refraction");
    expect(mode.nativeGlassBridge()).toBeNull();
  });

  it("une coquille qui lève ne casse pas la page", async () => {
    const bridge = fakeBridge(true);
    bridge.setEnabled.mockImplementation(() => {
      throw new Error("pont perdu");
    });
    const { attribute } = await boot({ platform: "darwin", bridge, stored: "true" });
    expect(attribute()).toBe("native");
  });
});
