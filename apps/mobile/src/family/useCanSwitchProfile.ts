import { usePickerListing } from "./profiles/usePickerListing";

/**
 * « Changer de profil » dans Réglages › Compte : vrai seulement si le serveur
 * sait ouvrir une session de profil sur un mobile (`family.mobileProfiles`)
 * et que la famille du compte compte plus d'une personne. Faux tant que rien
 * n'est su, hors ligne, et face à un serveur qui ne déclare rien. La ligne
 * mène à `/who-is-watching`.
 */
export function useCanSwitchProfile(): boolean {
  const { data, enabled } = usePickerListing();
  return enabled && data?.pickerRequired === true;
}
