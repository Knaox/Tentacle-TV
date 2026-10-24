/**
 * Octave — le moteur audio de la page. L'interface n'importe QUE d'ici : le
 * fournisseur, ses crochets, et le port (`AudioEnginePort`, shared/music).
 */

export { AudioEngineProvider, useAudioEngine, useAudioEngineState } from "./AudioEngineProvider";
export { createAudioEngine, preferredEngine, type EngineKind } from "./createAudioEngine";
export type { MusicEngineAuth } from "./engineShared";
export type { EnginePrefs } from "./mpv/mpvAudioEngine";
