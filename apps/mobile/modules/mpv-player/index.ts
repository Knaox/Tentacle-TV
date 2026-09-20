// Le lecteur avancé (libmpv) : vue native et fonctions d'appareil. iOS pour
// l'instant ; sans le module natif, `isMpvAvailable()` répond faux et la vue
// ne rend rien.
export * from "./src/MpvPlayer.types";
export {
  addMpvLogListener,
  isAirPlayRouteActive,
  isMpvAvailable,
  isMpvSimulator,
  supportsAv1HardwareDecode,
} from "./src/MpvPlayerModule";
export { MpvPlayerView } from "./src/MpvPlayerView";
