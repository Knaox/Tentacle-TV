// Le lecteur avancé (libmpv) : vue native et fonctions d'appareil, iOS
// (MPVKit) et Android (libmpv-android). Sans le module natif (ancien build),
// `isMpvAvailable()` répond faux et la vue ne rend rien.
export * from "./src/MpvPlayer.types";
export {
  addMpvLogListener,
  getDisplayModes,
  isAirPlayRouteActive,
  isMpvAvailable,
  isMpvSimulator,
  setPreferredDisplayMode,
  supportsAv1HardwareDecode,
  type DisplaySnapshot,
} from "./src/MpvPlayerModule";
export { MpvPlayerView } from "./src/MpvPlayerView";
