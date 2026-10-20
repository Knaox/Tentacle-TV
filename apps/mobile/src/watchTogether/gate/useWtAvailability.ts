import { useAccountAbilities, useServerCapability, useWatchTogetherAccess, watchTogetherAbility } from "@tentacle-tv/api-client";
import { wtAvailability, type WtAvailability } from "./wtAvailability";

/**
 * La porte du Watch Together mobile (voir `wtAvailability`). Le droit vient de
 * ce que la session peut faire (`account.abilities` : `SyncPlayAccess` du compte,
 * « none » pour un invité de la Famille et tant que ce n'est pas su) ; face à un
 * serveur d'avant, de `/api/watch-together/access` comme avant.
 */
export function useWtAvailability(): WtAvailability {
  const deviceMembership = useServerCapability("watchTogether.deviceMembership");
  const legacy = useWatchTogetherAccess();
  const level = watchTogetherAbility(useAccountAbilities(), legacy.access ?? "none");
  return wtAvailability(deviceMembership, { mayJoin: level !== "none", mayCreate: level === "full" });
}
