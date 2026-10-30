/**
 * Octave (mobile) — le moteur audio de l'app : le module natif `octave-audio` (mpv sur iOS, Media3 sur Android)
 * derrière l'adaptateur du pont PARTAGÉ avec le bureau (`createBridgeAudioEngine`), avec la méta que le système
 * affiche (écran verrouillé, notification). Sans le module (ancien build) : un démarrage en échec, que le lecteur
 * dit comme une erreur de moteur.
 */

import type { AudioEnginePort } from "@tentacle-tv/shared/music";
import { createBridgeAudioEngine, type EnginePrefs, type MusicEngineAuth } from "@tentacle-tv/shared/octave";
import { isOctaveAudioAvailable, octaveAudioBridge } from "../../../modules/octave-audio";
import { phoneDirectSources } from "../clientFetch/phoneDelegation";
import { orderedBridge } from "./mobileAudioBridge";
import { keptCoverForUrl } from "../offline/useKeptMusic";

const bridge = orderedBridge(octaveAudioBridge, phoneDirectSources);

export function createMobileAudioEngine(auth: MusicEngineAuth, prefs: EnginePrefs): Promise<AudioEnginePort> {
  if (!isOctaveAudioAvailable()) return Promise.reject(new Error("octave-audio: module natif absent"));
  // L'écran verrouillé : la pochette gardée d'abord (un fichier ; hors ligne, l'adresse du serveur ne répond pas).
  return createBridgeAudioEngine(bridge, auth, prefs, { systemMeta: true, localArtwork: (track) => keptCoverForUrl(track.artworkUrl) });
}
