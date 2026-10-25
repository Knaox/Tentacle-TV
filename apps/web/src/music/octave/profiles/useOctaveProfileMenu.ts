import { useMemo } from "react";
import { useActiveProfile } from "../../../auth/profileSession";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { usePickerListing } from "../../../profiles/api/usePickerListing";
import { octaveProfileMenu, type OctaveProfileMenu } from "./octaveProfileMenu";

/** Le menu du profil d'Octave pour la session ouverte ; null : pas de menu (voir `octaveProfileMenu`). */
export function useOctaveProfileMenu(): { menu: OctaveProfileMenu | null; activeProfileId: string | null; refetch: () => void } {
  const { listing, enabled } = usePickerListing();
  const offline = useOfflineMode();
  const active = useActiveProfile();
  const activeProfileId = active?.id ?? null;
  const menu = useMemo(
    () => octaveProfileMenu({ listing: listing.data, enabled, offline, activeProfileId }),
    [listing.data, enabled, offline, activeProfileId],
  );
  const { refetch } = listing;
  return { menu, activeProfileId, refetch: () => void refetch() };
}
