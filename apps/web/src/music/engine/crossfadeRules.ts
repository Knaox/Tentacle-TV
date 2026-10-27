/**
 * La « transition douce » d'Octave : ses règles PURES vivent dans le partagé (`@tentacle-tv/shared/octave` ›
 * `crossfadeRules.ts`), communes au web, au bureau et au mobile. Ce module les réexporte pour les moteurs du web.
 */

export {
  CROSSFADE_DEFAULT_MS,
  CROSSFADE_DEFAULT_S,
  CROSSFADE_MAX_S,
  CROSSFADE_MIN_S,
  CROSSFADE_STORAGE_KEY,
  continuesAlbum,
  fadeInGain,
  fadeOutGain,
  plannedCrossfadeMs,
  readCrossfadeSetting,
  sanitizeCrossfadeMs,
  type CrossfadePair,
} from "@tentacle-tv/shared/octave";
