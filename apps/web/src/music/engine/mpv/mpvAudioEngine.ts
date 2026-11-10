/**
 * Le port `AudioEnginePort` sur le moteur NATIF du bureau (mpv en audio seul, `apps/desktop-electron/src/main/audio/`) :
 * l'adaptateur du pont est PARTAGÉ avec le mobile (`@tentacle-tv/shared/octave`, `engine/bridgeAudioEngine.ts`).
 */

import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import { createBridgeAudioEngine, type EnginePrefs, type MusicEngineAuth, type NativeBridge } from "@tentacle-tv/shared/octave";
import { supportsSystemMediaSession } from "../../../desktop/bridge";

export { bridgeSource, bridgeTrack, type EnginePrefs, type NativeBridge } from "@tentacle-tv/shared/octave";

/**
 * Démarre le moteur natif du bureau (instance mpv gardée chaude) et rend le port. La fiche de chaque
 * titre (titre, artistes, album, pochette) part avec lui là où la coquille publie « À l'écoute »
 * (`supportsSystemMediaSession` : Tentacle CEF) ; Electron n'en a pas l'usage, rien ne change pour lui.
 */
export function createMpvAudioEngine(bridge: NativeBridge, auth: MusicEngineAuth, prefs: EnginePrefs): Promise<AudioEnginePort> {
  return createBridgeAudioEngine(bridge, auth, prefs, supportsSystemMediaSession() ? { systemMeta: true } : {});
}
