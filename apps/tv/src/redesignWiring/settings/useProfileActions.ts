import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { readProfileRecord, tvSessionMode } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import type { SettingsProfile } from "../../redesign/screens/settings/settingsTypes";
import { switchProfile } from "../../auth/profileSession";

/**
 * Le profil ouvert, tel que Réglages › Compte le montre (Famille, Apple TV),
 * et ses deux gestes : « Changer de profil » (la file des rapports part avec
 * le jeton du profil, puis « Qui regarde ? ») et « Gérer les profils » (le
 * profil du propriétaire). TV d'avant les profils : `profile` est nul, rien
 * ne change.
 */
export function useProfileActions() {
  const { t } = useTranslation(["familyTv", "family"]);
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const record = tvSessionMode(storage) === "profile" ? readProfileRecord(storage) : null;
  const kind = record?.kind ?? null;
  const ownerName = record?.ownerName ?? "";
  const color = record?.color ?? null;
  const canManage = record?.canManage === true;

  const profile = useMemo<SettingsProfile | null>(() => {
    if (!kind || !color) return null;
    const owner = { owner: ownerName };
    const role =
      kind === "owner"
        ? t("familyTv:settings.owner")
        : kind === "member"
          ? t("familyTv:settings.memberOf", owner)
          : t("family:guestOf", owner);
    return {
      role,
      color,
      canManage: kind === "owner" && canManage,
      unpairNote: kind === "owner" ? null : t("familyTv:settings.unpairOwnerOnly", owner),
    };
  }, [kind, ownerName, color, canManage, t]);

  const onSwitchProfile = useCallback(() => {
    void switchProfile({ jfClient, storage, queryClient });
  }, [jfClient, storage, queryClient]);
  const onManageProfiles = useCallback(() => navigation.navigate("ManageProfiles", { origin: "settings" }), [navigation]);

  return { profile, onSwitchProfile, onManageProfiles };
}
