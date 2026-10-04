import { useAppConfig } from "@tentacle-tv/api-client";
import type { FamilyCapability } from "@tentacle-tv/shared";
import { useOfflineMode } from "../offline/useOfflineMode";
import { isFamilyAvailable } from "./familyModel";

/** La Famille sur ce serveur, d'après `/api/config` › `features.family` : un
 *  serveur d'avant ne la déclare pas, et rien ne s'en montre alors. */
export function useFamilyAvailability(): { available: boolean; capability: FamilyCapability | undefined } {
  const { data } = useAppConfig();
  const offline = useOfflineMode();
  const capability = data?.features.family;
  return { available: isFamilyAvailable(capability, offline), capability };
}
