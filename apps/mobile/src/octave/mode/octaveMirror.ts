/**
 * Octave (mobile) — le miroir de la disponibilité (`tentacle_octave_launch`,
 * même clé et même forme que le bureau) : la dernière réponse ÉTABLIE du
 * serveur pour cette identité, que le prochain lancement lit avant tout réseau.
 * Une panne n'y entre jamais. Aucun secret.
 */

import { OCTAVE_LAUNCH_MIRROR_KEY, parseOctaveLaunchMirror } from "@tentacle-tv/shared/octave/mode";
import { currentOctaveOwner } from "../cache/octavePageStore";
import { octaveStorage } from "./octaveModeStore";

export function noteOctaveAvailability(available: boolean): void {
  const storage = octaveStorage();
  const owner = currentOctaveOwner();
  if (!storage || owner === null) return;
  const known = parseOctaveLaunchMirror(storage.getItem(OCTAVE_LAUNCH_MIRROR_KEY));
  if (known?.owner === owner && known.available === available) return;
  storage.setItem(OCTAVE_LAUNCH_MIRROR_KEY, JSON.stringify({ owner, available }));
}

/** Le miroir gardé dit-il Octave disponible pour la session en cours ? */
export function mirrorAvailableNow(): boolean {
  const storage = octaveStorage();
  const owner = currentOctaveOwner();
  if (!storage || owner === null) return false;
  const mirror = parseOctaveLaunchMirror(storage.getItem(OCTAVE_LAUNCH_MIRROR_KEY));
  return mirror?.owner === owner && mirror.available;
}
