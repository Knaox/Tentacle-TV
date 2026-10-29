// Le moteur audio d'Octave sur le mobile : un module natif qui parle le MÊME
// pont que la coquille du bureau (`@tentacle-tv/shared/octave`,
// `engine/audioBridgeContract.ts`) — mpv (MPVKit) sur iOS, Media3 sur Android.
// Lecture en arrière-plan, écran verrouillé / notification média, interruptions,
// enchaînement sans blanc et transition douce vivent dans le natif. Sans le
// module (ancien build), `isOctaveAudioAvailable()` répond faux.
export { isOctaveAudioAvailable, octaveAudioBridge, octaveAudioLaunchId, octaveAudioSupportsDirect } from "./src/OctaveAudioModule";
