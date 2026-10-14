import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppConfig, useServerCapability } from "@tentacle-tv/api-client";
import { accountUserId } from "../../auth/profileSession";
import { isDesktopApp } from "../../desktop/detect";
import { getBackendBase } from "../../lib/backendBase";
import { writeLaunchMirror } from "../launch/launchState";
import { loadPickerProfiles, pickerProfilesKey } from "./pickerGateway";

/**
 * La famille vue par « Qui regarde ? », pour l'application OUVERTE (le menu
 * de l'avatar, le réglage) : seulement sur le bureau, face à un serveur qui
 * déclare `family.desktopProfiles` et la Famille — sinon aucune requête. Chaque
 * réponse rafraîchit le miroir de l'ouverture (`launchState.ts`) : la
 * prochaine ouverture décide d'après ce que l'application vient de lire.
 */
export function usePickerListing() {
  const { listing, enabled, accountId } = usePickerListingQuery();
  const { data } = listing;
  useEffect(() => {
    if (data && accountId) writeLaunchMirror({ server: getBackendBase(), accountId, capable: true, listing: data });
  }, [data, accountId]);

  return { listing, enabled, accountId };
}

/**
 * La même famille, la même requête (même clé, même cache), sans toucher au
 * miroir de l'ouverture : pour qui la LIT seulement — la couleur du rond du
 * compte (`face/useAccountFaceColor.ts`).
 */
export function usePickerListingQuery() {
  const capable = useServerCapability("family.desktopProfiles");
  const { data: config } = useAppConfig();
  const accountId = accountUserId();
  const enabled = isDesktopApp() && capable && config?.features.family !== undefined && accountId !== null;

  const listing = useQuery({
    queryKey: pickerProfilesKey(accountId),
    queryFn: ({ signal }) => loadPickerProfiles(signal),
    enabled,
    staleTime: 30_000,
    retry: false,
  });
  return { listing, enabled, accountId };
}
