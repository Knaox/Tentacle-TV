/**
 * Octave (mobile) — ce que l'axe `m5` branche dans la coquille : « Sur cet appareil » (`device`) et la portée de
 * la musique gardée (`MusicOfflineScope` : porte « garder », tenue à jour, identités changées), et la capsule
 * « Hors ligne » visible sur toute page d'Octave tant que l'application l'est (`OctaveOfflinePill`).
 * Seul `m5` édite ce fichier.
 */

import { MusicOfflineScope } from "../../offline/MusicOfflineScope";
import { OctaveDeviceScreen } from "../../offline/OctaveDeviceScreen";
import { OctaveOfflinePill } from "../../offline/OctaveOfflinePill";
import type { OctaveAxisContribution } from "../octaveRegistryTypes";

export const m5Contribution: OctaveAxisContribution = {
  screens: { device: OctaveDeviceScreen },
  providers: [MusicOfflineScope],
  overlays: [OctaveOfflinePill],
};
