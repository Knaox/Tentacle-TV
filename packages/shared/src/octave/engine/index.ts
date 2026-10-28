/**
 * Octave — ce que TOUS les moteurs audio partagent : les règles du fondu enchaîné, le réglage « Transition
 * douce », le pont vers un moteur natif (bureau, mobile) et ses aides pures. Ni DOM, ni React Native.
 */
export * from "./crossfadeRules";
export * from "./crossfadeSetting";
export * from "./engineShared";
export * from "./audioBridgeContract";
export * from "./bridgeAudioEngine";
export * from "./deferredEngine";
export * from "./crossfadeControl";
export * from "./midTrackRecovery";
