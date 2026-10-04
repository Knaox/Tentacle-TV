import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { readProfileRecord, recordManages, recordPairedTheTv, tvSessionMode } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import type { SettingsProfile } from "../../redesign/screens/settings/settingsTypes";
import { switchProfile } from "../../auth/profileSession";

/**
 * Le profil ouvert, tel que Réglages › Compte le montre (Famille, Apple TV),
 * et ses deux gestes : « Changer de profil » (la file des rapports part avec
 * le jeton du profil, puis « Qui regarde ? ») et « Gérer les profils » (un
 * profil qui a quelque chose à gérer — v2 : le propriétaire ou un membre, avec
 * SES droits). Seul le profil du compte qui a jumelé la TV la déjumelle. TV
 * d'avant les profils : `profile` est nul, rien ne change.
 */
export function useProfileActions() {
  const { t } = useTranslation(["familyTv", "family"]);
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const record = tvSessionMode(storage) === "profile" ? readProfileRecord(storage) : null;
  const kind = record?.kind ?? null;
  // Le compte de la TV (seul à la déjumeler) et le propriétaire de la famille : deux comptes en v2.
  const tvAccountName = record?.ownerName ?? "";
  const familyOwnerName = record?.familyOwnerName ?? tvAccountName;
  const color = record?.color ?? null;
  const manages = record ? recordManages(record) : false;
  const pairedTheTv = record ? recordPairedTheTv(record) : false;

  const profile = useMemo<SettingsProfile | null>(() => {
    if (!kind || !color) return null;
    const family = { owner: familyOwnerName };
    const role =
      kind === "owner"
        ? t("familyTv:settings.owner")
        : kind === "member"
          ? t("familyTv:settings.memberOf", family)
          : t("family:guestOf", family);
    return {
      role,
      color,
      canManage: manages,
      canUnpair: pairedTheTv,
      unpairCaption: pairedTheTv ? t("familyTv:settings.unpairCaption") : t("familyTv:settings.unpairOwnerOnly", { owner: tvAccountName }),
    };
  }, [kind, familyOwnerName, tvAccountName, color, manages, pairedTheTv, t]);

  const onSwitchProfile = useCallback(() => {
    void switchProfile({ jfClient, storage, queryClient });
  }, [jfClient, storage, queryClient]);
  const onManageProfiles = useCallback(() => navigation.navigate("ManageProfiles", { origin: "settings" }), [navigation]);

  return { profile, onSwitchProfile, onManageProfiles };
}
