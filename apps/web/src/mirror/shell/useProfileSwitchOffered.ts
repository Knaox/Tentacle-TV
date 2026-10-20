import { useOfflineMode } from "../../offline/useOfflineMode";
import { usePickerListing } from "../../profiles/api/usePickerListing";

/**
 * « Changer de profil » a-t-il un sens ici ? La règle du menu de l'avatar
 * (`useProfileMenuItems`) : le serveur ouvre les profils à cette plateforme
 * (`usePickerListing().enabled`), la famille impose le choix et compte au
 * moins deux profils, et l'on est en ligne (la bascule passe par le serveur).
 * La ligne des réglages et la puce de l'en-tête du miroir la lisent toutes deux.
 */
export function useProfileSwitchOffered(): boolean {
  const offline = useOfflineMode();
  const { listing, enabled } = usePickerListing();
  return enabled && !offline && listing.data?.pickerRequired === true && listing.data.profiles.length >= 2;
}
