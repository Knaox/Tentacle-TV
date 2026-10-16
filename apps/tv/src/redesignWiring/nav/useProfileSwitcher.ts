import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { RAIL_SWITCH_PROFILE_KEY, railSwitcherSummary, tvSessionMode } from "@tentacle-tv/tv-core";
import type { NavSwitcher } from "../../redesign/nav/NavRail";
import { profileAvatarUri } from "../profiles/profilesModel";
import { useTvFamilyListing } from "../profiles/useTvFamilyListing";

/**
 * « Changer de profil » dans le rail — sur une Apple TV passée aux profils
 * (Famille) seulement ; ailleurs, rien. Son pictogramme : la photo du profil
 * connecté et « +N », les autres profils de la TV (tv-core
 * `railSwitcherSummary`, sur `useTvFamilyListing`, une lecture partagée) ;
 * tant qu'ils ne sont pas lus, une silhouette.
 */
export function useProfileSwitcher(): NavSwitcher | null {
  const { t } = useTranslation("familyTv");
  const { storage } = useTentacleConfig();
  const data = useTvFamilyListing();
  const userId = useUserId();
  const profileMode = tvSessionMode(storage) === "profile";
  const serverUrl = profileMode ? storage.getItem("tentacle_server_url") : null;
  const label = t("settings.switchProfile");
  return useMemo<NavSwitcher | null>(() => {
    if (!serverUrl) return null;
    const profiles = (data?.profiles ?? []).map((profile) => ({
      id: profile.userId,
      name: profile.name,
      color: profile.color,
      avatarUri: profileAvatarUri(serverUrl, profile.userId, profile.imageTag),
    }));
    const { current, badge } = railSwitcherSummary(profiles, userId ?? null);
    return { key: RAIL_SWITCH_PROFILE_KEY, label, current, badge };
  }, [serverUrl, data, label, userId]);
}
