/**
 * Octave — la DÉCONNEXION efface tout ce que l'appareil gardait de la musique,
 * toutes identités confondues : les pages gardées (IndexedDB), la page en
 * cours, le dernier titre et la file, le miroir de la disponibilité. Appelée
 * par la sortie de session (`launchState.ts` › `noteLoggedOut`), par où
 * qu'elle passe.
 */

import { forgetOctaveLaunchMirror } from "../mode/octaveLaunchStore";
import { octaveCacheBackend } from "./octaveCacheBoot";
import { forgetSavedOctavePage } from "./pageResume";
import { forgetOctavePlayer } from "./playerResume";

export function forgetOctaveDevice(): void {
  forgetSavedOctavePage();
  forgetOctavePlayer();
  forgetOctaveLaunchMirror();
  const backend = octaveCacheBackend();
  void backend
    .loadAll()
    .then((entries) => backend.remove(entries.map((entry) => entry.id)))
    .catch(() => undefined);
}
