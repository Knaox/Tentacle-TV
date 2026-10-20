import { useServerCapability, useWatchTogetherAccess } from "@tentacle-tv/api-client";
import { wtAvailability, type WtAvailability } from "./wtAvailability";

/** La porte du Watch Together mobile (voir `wtAvailability`). */
export function useWtAvailability(): WtAvailability {
  const deviceMembership = useServerCapability("watchTogether.deviceMembership");
  const access = useWatchTogetherAccess();
  return wtAvailability(deviceMembership, access);
}
