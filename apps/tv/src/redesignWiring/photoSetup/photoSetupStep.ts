import { tvSessionMode } from "@tentacle-tv/tv-core";
import { tvStorage } from "../../storage/RNStorageAdapter";

/**
 * L'étape « Photo du profil » du premier passage — la TROISIÈME fenêtre du
 * démarrage, après la barre (tv-core `nav/startupWindows`). L'écran et la
 * règle (« faut-il proposer la photo ? », un invité compris) viennent de la
 * galerie d'avatars de la TV ; tant qu'ils ne sont pas branchés, l'étape
 * n'est jamais due (`PHOTO_SETUP_ENABLED`) et sa route passe aussitôt.
 */
export const PHOTO_SETUP_ENABLED = false;

/** L'étape reste-t-elle à proposer au profil ouvert ? Lecture synchrone, pour le registre du démarrage. */
export function photoSetupPending(): boolean {
  return PHOTO_SETUP_ENABLED && tvSessionMode(tvStorage) === "profile";
}
