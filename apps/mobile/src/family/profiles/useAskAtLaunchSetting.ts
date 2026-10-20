import { useCallback, useSyncExternalStore } from "react";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { MOBILE_PROFILE_STAY_KEY, mobileProposesAtLaunch, pickerStayState, readMobileStay } from "@tentacle-tv/shared";
import { useServerUrl } from "@/providers/ServerUrlContext";
import { readLaunchChoice, stayOnProfile, subscribeLaunchChoice, writeLaunchChoice } from "./launchChoice";
import { useAccountUserId } from "./profileSessionState";
import { usePickerListing } from "./usePickerListing";

export interface AskAtLaunchSetting {
  /** « Qui regarde ? » proposé au démarrage (l'interrupteur). */
  proposes: boolean;
  /** Coupé : le nom du profil que l'appareil ouvrira, s'il est connu et vaut encore. */
  stayName: string | null;
  /** Rien à régler tant que la famille n'a pas répondu. */
  ready: boolean;
  set: (on: boolean) => void;
}

/**
 * Réglages › Compte : « Qui regarde ? » au démarrage, réglé par CET appareil
 * (règle partagée `familyMobileLaunch.ts`) — l'interrupteur jumeau de la case
 * « Ne plus proposer au démarrage ». Allumé : `ask`. Éteint : l'appareil
 * retient le profil EN COURS d'après le serveur (`stayOnProfile`).
 */
export function useAskAtLaunchSetting(): AskAtLaunchSetting {
  const { storage } = useTentacleConfig();
  const { serverUrl } = useServerUrl();
  const accountId = useAccountUserId();
  const listing = usePickerListing();
  const deps = { storage, serverUrl: serverUrl ?? "" };
  const read = useCallback(() => readLaunchChoice({ storage, serverUrl: serverUrl ?? "" }), [storage, serverUrl]);
  const choice = useSyncExternalStore(subscribeLaunchChoice, read, read);
  const data = listing.data;
  const stay = serverUrl && accountId ? readMobileStay(storage.getItem(MOBILE_PROFILE_STAY_KEY), serverUrl, accountId) : null;
  const stayProfile = choice === "stay" && stay && data && pickerStayState(data, stay, Date.now()) !== "stale"
    ? data.profiles.find((profile) => profile.userId === stay.profileId) ?? null
    : null;

  const set = (on: boolean) => {
    if (on) {
      writeLaunchChoice(deps, "ask");
      return;
    }
    const current = data?.profiles.find((profile) => profile.userId === data.currentProfileId);
    if (current) stayOnProfile(deps, current);
  };

  return { proposes: mobileProposesAtLaunch(choice), stayName: stayProfile?.name ?? null, ready: !!data, set };
}
