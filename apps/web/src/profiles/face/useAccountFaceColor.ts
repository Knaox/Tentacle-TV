import { useMemo } from "react";
import { personalColorOf, type FamilyProfileColor, type PickerProfilesDto } from "@tentacle-tv/shared";

// La règle est partagée avec le mobile (shared `family/familyFaceColor.ts`).
export { personalColorOf };
import { useActiveProfile } from "../../auth/profileSession";
import { getBackendBase } from "../../lib/backendBase";
import { usePickerListingQuery } from "../api/usePickerListing";
import { readLaunchMirror } from "../launch/launchState";

/**
 * La COULEUR du rond du compte — barre du haut et son menu, barre d'onglets du
 * bas et page Profil d'une fenêtre étroite — : celle que « Qui regarde ? » et
 * « Changer de profil » lui donnent, la même partout.
 *
 * - Session d'un profil : la sienne.
 * - Session personnelle dans une famille d'au moins deux profils (serveur qui
 *   déclare `family.desktopProfiles`) : celle du profil du compte, lue dans la
 *   liste — et, tant qu'elle n'a pas répondu, dans le miroir de l'ouverture
 *   (même serveur, même compte) : le rond ne change pas de teinte sous les yeux.
 * - Sinon (aucune famille, serveur d'avant, web, mobile) : null — le dégradé
 *   de marque, comme avant.
 *
 * La photo du compte, s'il en a une, reste devant : la couleur n'habille que
 * l'initiale et le halo.
 */
export function useAccountFaceColor(): FamilyProfileColor | null {
  const active = useActiveProfile();
  const { listing, enabled, accountId } = usePickerListingQuery();
  const fresh = listing.data;
  // Le miroir n'est lu qu'à défaut de la liste, et seulement là où elle a cours.
  const awaiting = active === null && enabled && fresh === undefined;
  const mirrored = useMemo(() => (awaiting ? mirroredListing(accountId) : null), [awaiting, accountId]);
  if (active) return active.color;
  if (!enabled) return null;
  return personalColorOf(fresh ?? mirrored);
}


function mirroredListing(accountId: string | null): PickerProfilesDto | null {
  const mirror = readLaunchMirror();
  if (!mirror?.capable || !mirror.listing) return null;
  if (mirror.accountId !== accountId || mirror.server !== getBackendBase()) return null;
  return mirror.listing;
}
