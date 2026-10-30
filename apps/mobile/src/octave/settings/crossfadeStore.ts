/**
 * Octave (mobile) — « Transition douce » : UN magasin, celui du lecteur (`../audio/crossfadeSetting.ts`, m2 :
 * `createCrossfadeSetting` du partagé, allumé à 5 s, clé `tentacle_octave_crossfade`). La page « Réglages
 * d'Octave » le lit et l'écrit par ces noms ; le stockage lui est branché dès qu'il est prêt (avant toute lecture),
 * sans attendre le montage du lecteur.
 */

import { CROSSFADE_DEFAULT_MS, CROSSFADE_MAX_S, CROSSFADE_MIN_S } from "@tentacle-tv/shared/octave";
import { bindCrossfadeStorage } from "../audio/crossfadeSetting";
import { deviceStorage, onDeviceStorageReady } from "./deviceSetting";

export { getCrossfadeMs, setCrossfadeMs, subscribeCrossfade, useCrossfadeMs } from "../audio/crossfadeSetting";
export { CROSSFADE_DEFAULT_MS, CROSSFADE_MAX_S, CROSSFADE_MIN_S };

onDeviceStorageReady(() => {
  const storage = deviceStorage();
  if (storage) bindCrossfadeStorage(storage);
});
