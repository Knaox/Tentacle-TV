import { useFamilyOverview } from "@tentacle-tv/api-client";
import { familyEntryShown } from "@tentacle-tv/shared";
import { useFamilySettingsAvailability } from "./useFamilyAvailability";

/**
 * L'entrée « Famille » des réglages (bureau, web, fenêtre étroite) mène-t-elle à quelque chose
 * pour ce compte (shared `familyEntryShown`) ? Sa famille, une invitation reçue, ou une famille
 * qu'il peut fonder : un droit coupé par l'administration n'y laisse rien. Même requête que
 * l'affiche d'invitation, relue en direct (`family:update`). Rien tant qu'elle n'a pas répondu ;
 * en échec (un profil dont la gestion est fermée, le réseau), l'entrée reste : la page le dit.
 */
export function useFamilyEntryShown(): boolean {
  const { available } = useFamilySettingsAvailability();
  const overview = useFamilyOverview({ enabled: available });
  if (!available) return false;
  if (overview.isError) return true;
  return familyEntryShown(overview.data, Date.now()) === true;
}
