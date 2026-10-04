import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useNavigation, type NavigationProp } from "@react-navigation/native";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { ownPinModes, readProfileRecord, recordManages, recordPairedTheTv, tvSessionMode, type OwnPinMode } from "@tentacle-tv/tv-core";
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
  // Relu à chaque retour sur l'écran : le pavé du code PIN vient de mettre le profil à jour.
  useIsFocused();
  const record = tvSessionMode(storage) === "profile" ? readProfileRecord(storage) : null;
  const kind = record?.kind ?? null;
  // Le compte de la TV (seul à la déjumeler) et le propriétaire de la famille : deux comptes en v2.
  const tvAccountName = record?.ownerName ?? "";
  const familyOwnerName = record?.familyOwnerName ?? tvAccountName;
  const color = record?.color ?? null;
  const manages = record ? recordManages(record) : false;
  const hasPin = record?.hasPin === true;
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
      pin: { hasPin, modes: ownPinModes(kind, hasPin) },
    };
  }, [kind, familyOwnerName, tvAccountName, color, manages, pairedTheTv, hasPin, t]);

  const onSwitchProfile = useCallback(() => {
    void switchProfile({ jfClient, storage, queryClient });
  }, [jfClient, storage, queryClient]);
  const onManageProfiles = useCallback(() => navigation.navigate("ManageProfiles", { origin: "settings" }), [navigation]);

  // Le pavé du code PIN est ouvert : au retour, le focus rejoint la section (`useOwnPinReturn`).
  const pinOpened = useRef(false);
  const onOwnPin = useCallback(
    (mode: OwnPinMode) => {
      pinOpened.current = true;
      navigation.navigate("ProfilePin", { mode });
    },
    [navigation],
  );

  return { profile, onSwitchProfile, onManageProfiles, onOwnPin, pinOpened };
}
