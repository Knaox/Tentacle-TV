import { useFamilyOverview } from "@tentacle-tv/api-client";
import { faceColorOf, type FamilyProfileColor } from "@tentacle-tv/shared";
import { useFamilyAvailability } from "../useFamilyAvailability";
import { useActiveProfile, useAccountUserId } from "./profileSessionState";
import { usePickerListing } from "./usePickerListing";

/**
 * La couleur du rond du profil EN COURS quand il n'a pas de photo — la puce de
 * l'en-tête, la page Profil — : celle de « Qui regarde ? » et de la Famille
 * (règle partagée `faceColorOf`). null : le dégradé de marque (pas de famille,
 * serveur d'avant). Aucune requête de plus : les listes sont déjà en cache.
 */
export function useAccountFaceColor(): FamilyProfileColor | null {
  const active = useActiveProfile();
  const accountId = useAccountUserId();
  const listing = usePickerListing();
  const { available } = useFamilyAvailability();
  const overview = useFamilyOverview({ enabled: available && active === null });
  return faceColorOf({ activeColor: active?.color ?? null, listing: listing.data, overview: overview.data, accountId });
}
