import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { fetchTvProfiles, useTentacleConfig } from "@tentacle-tv/api-client";
import { RAIL_SWITCH_PROFILE_KEY, tvSessionMode } from "@tentacle-tv/tv-core";
import type { NavSwitcher } from "../../redesign/nav/NavRail";
import { pairingCall } from "../../auth/profileOpening";
import { profileAvatarUri } from "../profiles/profilesModel";

/** Les profils changent rarement : relus au plus toutes les cinq minutes (le rail est sur tous les écrans). */
const PROFILES_STALE_MS = 5 * 60_000;

/**
 * « Changer de profil » dans le rail — sur une Apple TV passée aux profils
 * (Famille) seulement ; ailleurs, rien. Son pictogramme empile les profils de
 * la famille, lus par le jeton de JUMELAGE (le seul usage qu'en fait la TV avec
 * « Qui regarde ? ») ; tant qu'ils ne sont pas lus, une silhouette.
 */
export function useProfileSwitcher(): NavSwitcher | null {
  const { t } = useTranslation("familyTv");
  const { storage } = useTentacleConfig();
  const call = tvSessionMode(storage) === "profile" ? pairingCall(storage) : null;
  const { data } = useQuery({
    queryKey: ["tv-profiles", "rail"],
    queryFn: ({ signal }) => fetchTvProfiles({ ...(call as NonNullable<typeof call>), signal }),
    enabled: call !== null,
    staleTime: PROFILES_STALE_MS,
  });
  const serverUrl = call?.serverUrl ?? null;
  const label = t("settings.switchProfile");
  return useMemo<NavSwitcher | null>(() => {
    if (!serverUrl) return null;
    const profiles = (data?.profiles ?? []).map((profile) => ({
      id: profile.userId,
      name: profile.name,
      color: profile.color,
      avatarUri: profileAvatarUri(serverUrl, profile.userId, profile.imageTag, 96),
    }));
    return { key: RAIL_SWITCH_PROFILE_KEY, label, profiles };
  }, [serverUrl, data, label]);
}
