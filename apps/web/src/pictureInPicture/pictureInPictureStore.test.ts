import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  endPipSession, getPipSession, preferredPipMode, rememberPipMode, startPipSession, updatePipSession, watchLocation,
} from "./pictureInPictureStore";

/**
 * La session PiP vit hors de React : la route du lecteur s'en va au moment
 * même où elle commence, et c'est elle qui garde le lecteur monté.
 */

// `localStorage` est absent de l'environnement de test.
const storage = new Map<string, string>();
beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  });
});
afterEach(() => {
  endPipSession();
  storage.clear();
  vi.unstubAllGlobals();
});

describe("session PiP", () => {
  it("commence, change d'épisode, se termine", () => {
    const location = watchLocation("/watch/abc?version=2");
    startPipSession({ location, mode: "floating", restoreFullscreen: true });
    expect(getPipSession()?.location.pathname).toBe("/watch/abc");
    expect(getPipSession()?.location.search).toBe("?version=2");
    updatePipSession({ location: watchLocation("/watch/def", { from: "pip" }) });
    expect(getPipSession()?.location.pathname).toBe("/watch/def");
    expect(getPipSession()?.location.state).toEqual({ from: "pip" });
    expect(getPipSession()?.restoreFullscreen).toBe(true);
    endPipSession();
    expect(getPipSession()).toBeNull();
  });

  it("une mise à jour sans session ne crée rien", () => {
    updatePipSession({ mode: "docked" });
    expect(getPipSession()).toBeNull();
  });

  it("chaque route d'épisode a sa propre clé, comme une vraie navigation", () => {
    expect(watchLocation("/watch/x").key).not.toBe(watchLocation("/watch/x").key);
  });
});

describe("mode retenu", () => {
  it("flottant par défaut, puis celui choisi la dernière fois", () => {
    expect(preferredPipMode()).toBe("floating");
    rememberPipMode("docked");
    expect(preferredPipMode()).toBe("docked");
  });
});
