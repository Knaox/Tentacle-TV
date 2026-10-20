import { openProfileSwitcher as openFamilySwitcher } from "@/family/profiles/profileSwitcherStore";
import { useCanSwitchProfile } from "@/family/useCanSwitchProfile";

/**
 * L'adaptateur de « Changer de profil » en un geste (consigne de Damien du
 * 20/10 : toucher son nom propose aussitôt les autres profils). La puce de
 * l'en-tête (`ProfileChip`) ne connaît que ces deux points d'entrée ; la
 * bascule elle-même — la liste des profils, le code PIN, la session de
 * profil — appartient à la Famille mobile (`src/family/`) : UNE feuille.
 */

/** La puce a-t-elle un sens ici ? (famille de deux profils au moins, serveur qui sait, en ligne) */
export function useProfileSwitchOffered(): boolean {
  return useCanSwitchProfile();
}

/** Ouvre la feuille « Changer de profil ». */
export function openProfileSwitcher(): void {
  openFamilySwitcher();
}
