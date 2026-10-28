/**
 * Octave (mobile) — ce que l'axe `m5` branche dans la coquille : « Sur cet appareil » (`device`) et la portée de
 * la musique gardée (`MusicOfflineScope` : porte « garder », tenue à jour, identités changées), et la capsule
 * « Hors ligne » visible sur toute page d'Octave tant que l'application l'est (`OctaveOfflinePill`).
 * Seul `m5` édite ce fichier.
 */

import { MusicOfflineScope } from "../../offline/MusicOfflineScope";
import { OctaveDeviceScreen } from "../../offline/OctaveDeviceScreen";
import { OctaveOfflinePill } from "../../offline/OctaveOfflinePill";
import { useOfflineProfileSession } from "../../../offline/rights/useOfflineOwner";
import type { OctaveAxisContribution } from "../octaveRegistryTypes";

/**
 * « Sur cet appareil » est au COMPTE DE L'APPAREIL : une session de profil n'en voit rien, pas même par son adresse
 * (elle renvoie à l'accueil d'Octave). Seul ce cas est CERTAIN au lancement : le droit `keepOffline` et la liste
 * gardée se lisent après, et la page se tait d'elle-même sans eux (lancement hors ligne sur cette page compris).
 */
const useDeviceAllowed = (): boolean => !useOfflineProfileSession();

export const m5Contribution: OctaveAxisContribution = {
  screens: { device: { component: OctaveDeviceScreen, requires: { useAllowed: useDeviceAllowed } } },
  providers: [MusicOfflineScope],
  overlays: [OctaveOfflinePill],
};
