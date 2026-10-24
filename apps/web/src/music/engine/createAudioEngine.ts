/**
 * Quel moteur pour CETTE plateforme : le natif (mpv en audio seul) dans la
 * coquille de bureau qui le déclare, `<audio>` partout ailleurs — le web, et
 * le bureau sans libmpv (Linux sans la bibliothèque : la commande n'est alors
 * pas déclarée, `supportsNativeAudio()` est faux).
 *
 * Un moteur natif qui refuse de démarrer n'est pas une impasse : on retombe
 * sur `<audio>`, et le journal le dit.
 */

import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import { invoke, listen, supportsNativeAudio } from "../../desktop/bridge";
import { elementSourceUrl, type MusicEngineAuth } from "./engineShared";
import { HtmlAudioEngine } from "./html/htmlAudioEngine";
import type { MediaElementLike } from "./html/htmlSlot";
import { createMpvAudioEngine, type EnginePrefs } from "./mpv/mpvAudioEngine";

export type EngineKind = "mpv" | "html";

/** Le moteur à prendre, sans rien démarrer. */
export function preferredEngine(nativeAvailable: boolean = supportsNativeAudio()): EngineKind {
  return nativeAvailable ? "mpv" : "html";
}

function sameOrigin(baseUrl: string): boolean {
  if (baseUrl === "" || typeof window === "undefined") return true;
  try {
    return new URL(baseUrl, window.location.href).origin === window.location.origin;
  } catch {
    return true;
  }
}

/** Le moteur `<audio>` sur le vrai DOM. */
export function createHtmlAudioEngine(auth: MusicEngineAuth, prefs: EnginePrefs): AudioEnginePort {
  const probe = document.createElement("audio");
  const engine = new HtmlAudioEngine({
    createElement: () => document.createElement("audio") as MediaElementLike,
    resolveUrl: (url) => elementSourceUrl(url, auth),
    credentials: auth.useCredentials && !sameOrigin(auth.baseUrl) ? "use-credentials" : null,
    canPlayType: (mime) => probe.canPlayType(mime),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id as number),
    now: () => performance.now(),
    listOutputs: async () => {
      const devices = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      return outputs.length === 0
        ? [{ id: "default", name: "", exclusiveCapable: false }]
        : outputs.map((d) => ({ id: d.deviceId, name: d.label, exclusiveCapable: false }));
    },
  });
  engine.setVolume(prefs.volume);
  engine.setMuted(prefs.muted);
  engine.setReplayGain(prefs.replayGain);
  return engine;
}

/** Démarre le moteur de la plateforme. */
export async function createAudioEngine(auth: MusicEngineAuth, prefs: EnginePrefs): Promise<AudioEnginePort> {
  if (preferredEngine() === "mpv") {
    try {
      return await createMpvAudioEngine({ invoke, listen }, auth, prefs);
    } catch (error) {
      console.warn("[music-engine] moteur natif indisponible, repli sur <audio>", error);
    }
  }
  return createHtmlAudioEngine(auth, prefs);
}
