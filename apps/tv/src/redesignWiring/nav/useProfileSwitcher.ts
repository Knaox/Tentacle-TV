import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { RAIL_SWITCH_PROFILE_KEY, tvSessionMode } from "@tentacle-tv/tv-core";
import type { NavSwitcher } from "../../redesign/nav/NavRail";
import { profileAvatarUri } from "../profiles/profilesModel";
import { useTvFamilyListing } from "../profiles/useTvFamilyListing";

/**
 * « Changer de profil » dans le rail — sur une Apple TV passée aux profils
 * (Famille) seulement ; ailleurs, rien. Son pictogramme empile les profils de
 * la famille (`useTvFamilyListing`, une lecture partagée) ; tant qu'ils ne
 * sont pas lus, une silhouette.
 */
export function useProfileSwitcher(): NavSwitcher | null {
  const { t } = useTranslation("familyTv");
  const { storage } = useTentacleConfig();
  const data = useTvFamilyListing();
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
    return { key: RAIL_SWITCH_PROFILE_KEY, label, profiles };
  }, [serverUrl, data, label]);
}
