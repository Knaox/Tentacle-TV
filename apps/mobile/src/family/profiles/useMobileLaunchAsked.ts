import { useServerCapability } from "@tentacle-tv/api-client";
import { mobileLaunchAsked } from "@tentacle-tv/shared";
import { usePickerListing } from "./usePickerListing";

/**
 * L'administration propose-t-elle « Qui regarde ? » d'office sur le mobile
 * (capacité `family.launchPlatforms`, `launchAsk` de la liste) ? Tant que la
 * liste n'a pas répondu, ou face à un serveur d'avant : oui.
 */
export function useMobileLaunchAsked(): boolean {
  const listing = usePickerListing();
  const capable = useServerCapability("family.launchPlatforms");
  return mobileLaunchAsked(listing.data ?? {}, capable);
}
