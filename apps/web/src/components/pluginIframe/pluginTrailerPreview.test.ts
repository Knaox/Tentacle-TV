/**
 * Les aperçus de bande-annonce d'une extension : l'état que l'hôte lui donne
 * (au montage, puis en direct), le message du son qu'il accepte — un booléen
 * seulement — et ce que le pont en fait DANS l'iframe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ block: null as string | null, listeners: new Set<() => void>() }));
vi.mock("../../trailerPreview/previewEnvironment", () => ({
  getTrailerPreviewBlock: () => h.block,
  subscribeTrailerPreviewBlock: (listener: () => void) => {
    h.listeners.add(listener);
    return () => h.listeners.delete(listener);
  },
}));

import { trailerPreviewMutedFlag, trailerPreviewVolumeLevel } from "../../trailerPreview/previewSettings";
import { buildPluginBridgeScript, type PluginHostEnv } from "./buildPluginBridge";
import {
  TRAILER_PREVIEW_ENV_EVENT, applyPluginTrailerPreviewMuted, applyPluginTrailerPreviewVolume, pluginTrailerPreviewEnv,
  trailerPreviewEnvMessage, watchPluginTrailerPreviewEnv,
} from "./pluginTrailerPreview";

function setBlock(next: string | null) {
  h.block = next;
  for (const listener of [...h.listeners]) listener();
}

beforeEach(() => {
  h.block = null;
  h.listeners.clear();
  trailerPreviewMutedFlag.set(false);
});

describe("état des aperçus pour une extension", () => {
  it("permis sans blocage, refusé dès qu'un blocage existe ; le son suit le drapeau", () => {
    expect(pluginTrailerPreviewEnv()).toEqual({ enabled: true, muted: false, volume: 0.6 });
    h.block = "setting";
    trailerPreviewMutedFlag.set(true);
    expect(pluginTrailerPreviewEnv()).toEqual({ enabled: false, muted: true, volume: 0.6 });
  });

  it("pousse chaque changement EN DIRECT, jamais deux fois la même valeur, et se désabonne", () => {
    const push = vi.fn();
    const stop = watchPluginTrailerPreviewEnv(push);
    expect(push).not.toHaveBeenCalled();
    setBlock("offline");
    setBlock("dataSaver");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenLastCalledWith({ enabled: false, muted: false, volume: 0.6 });
    trailerPreviewMutedFlag.set(true);
    expect(push).toHaveBeenLastCalledWith({ enabled: false, muted: true, volume: 0.6 });
    setBlock(null);
    expect(push).toHaveBeenLastCalledWith({ enabled: true, muted: true, volume: 0.6 });
    expect(push).toHaveBeenCalledTimes(3);
    stop();
    expect(h.listeners.size).toBe(0);
    trailerPreviewMutedFlag.set(false);
    expect(push).toHaveBeenCalledTimes(3);
  });
});

describe("message TRAILER_PREVIEW_MUTED d'une extension", () => {
  it("n'accepte qu'un booléen, et n'écrit que le drapeau du son", () => {
    expect(applyPluginTrailerPreviewMuted({ type: "TRAILER_PREVIEW_MUTED", muted: true })).toBe(true);
    expect(trailerPreviewMutedFlag.get()).toBe(true);
    for (const bad of [null, "x", {}, { muted: "false" }, { muted: 0 }, { muted: null }]) {
      expect(applyPluginTrailerPreviewMuted(bad)).toBe(false);
    }
    expect(trailerPreviewMutedFlag.get()).toBe(true);
    expect(applyPluginTrailerPreviewMuted({ muted: false })).toBe(true);
    expect(trailerPreviewMutedFlag.get()).toBe(false);
  });
});

/** Le pont, exécuté dans une fausse `window` d'iframe. */
function runBridge(hostEnv: PluginHostEnv) {
  const posted: unknown[] = [];
  const parent = { postMessage: (message: unknown) => posted.push(message) };
  const target = new EventTarget();
  const win = Object.assign(target, {
    fetch: async () => new Response("{}"),
  }) as unknown as EventTarget & Record<string, unknown>;
  const script = buildPluginBridgeScript({ backendUrl: "", hostEnv });
  const storage = { getItem: () => null };
  new Function("window", "parent", "localStorage", script)(win, parent, storage);
  const send = (data: unknown, source: unknown) => {
    const event = new MessageEvent("message", { data });
    Object.defineProperty(event, "source", { value: source });
    win.dispatchEvent(event);
  };
  return { win, parent, posted, send };
}

describe("le pont, dans l'iframe", () => {
  const env: PluginHostEnv = {
    tauri: false, desktop: false, mac: false, prod: true, backendUrl: "",
    trailerPreview: { enabled: true, muted: false, volume: 0.6 },
  };

  afterEach(() => vi.restoreAllMocks());

  it("pose l'état au montage, puis le met à jour et le dit à chaque message du PARENT", () => {
    const { win, parent, send } = runBridge(env);
    const tentacleEnv = () => (win.__tentacle_env as PluginHostEnv).trailerPreview;
    expect(tentacleEnv()).toEqual({ enabled: true, muted: false, volume: 0.6 });
    const heard = vi.fn();
    win.addEventListener(TRAILER_PREVIEW_ENV_EVENT, (e) => heard((e as CustomEvent).detail));

    send(trailerPreviewEnvMessage({ enabled: false, muted: true, volume: 0.6 }), parent);
    expect(tentacleEnv()).toEqual({ enabled: false, muted: true, volume: 0.6 });
    expect(heard).toHaveBeenCalledWith({ enabled: false, muted: true, volume: 0.6 });

    // Un autre émetteur (une iframe voisine, la page elle-même) n'y touche pas.
    send(trailerPreviewEnvMessage({ enabled: true, muted: false, volume: 0.6 }), {});
    expect(tentacleEnv()).toEqual({ enabled: false, muted: true, volume: 0.6 });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("le volume d'une extension : un nombre de 0 à 1 ; zéro coupe le son, au-dessus il le rend", () => {
    expect(applyPluginTrailerPreviewVolume({ volume: 0.3 })).toBe(true);
    expect([trailerPreviewVolumeLevel.get(), trailerPreviewMutedFlag.get()]).toEqual([0.3, false]);
    expect(applyPluginTrailerPreviewVolume({ volume: 0 })).toBe(true);
    expect([trailerPreviewVolumeLevel.get(), trailerPreviewMutedFlag.get()]).toEqual([0.3, true]);
    for (const bad of [null, {}, { volume: "0.5" }, { volume: 2 }, { volume: -1 }, { volume: Number.NaN }]) {
      expect(applyPluginTrailerPreviewVolume(bad)).toBe(false);
    }
    trailerPreviewVolumeLevel.set(0.6);
    trailerPreviewMutedFlag.set(false);
  });

  it("setTrailerPreviewMuted ne poste qu'un booléen", () => {
    const { win, posted } = runBridge(env);
    const bridge = win.__tentacle_bridge as { setTrailerPreviewMuted: (muted: unknown) => void };
    bridge.setTrailerPreviewMuted(true);
    bridge.setTrailerPreviewMuted("oui");
    expect(posted).toEqual([
      { type: "TRAILER_PREVIEW_MUTED", muted: true },
      { type: "TRAILER_PREVIEW_MUTED", muted: false },
    ]);
  });
});
