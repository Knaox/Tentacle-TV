import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useIsFocused, useNavigation, type NavigationProp } from "@react-navigation/native";
import { FAMILY_KEY, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { openProfileState, ownPinModesFor, profileAloneIn, readProfileRecord, recordPairedTheTv, tvSessionMode, type OwnPinMode, type TvProfileRole } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import type { SettingsProfile } from "../../redesign/screens/settings/settingsTypes";
import { switchProfile } from "../../auth/profileSession";
import { useTvFamilyListing } from "../profiles/useTvFamilyListing";

const ROLE_KEYS: Record<Exclude<TvProfileRole, "owner">, string> = {
  parent: "familyTv:settings.parentOf",
  member: "familyTv:settings.memberOf",
  guest: "family:guestOf",
};

/**
 * Le profil ouvert, tel que Réglages › Compte le montre (Famille, Apple TV,
 * Android TV), et ses deux gestes : « Changer de profil » (la file des
 * rapports part avec le jeton du profil, puis « Qui regarde ? ») et « Gérer les
 * profils » (un profil qui a quelque chose à gérer — le propriétaire, un parent
 * ou un membre, avec SES droits — et un code PIN : sans lui, l'indice qui mène
 * à « Créer un code PIN »). Le rôle et la gestion suivent la liste RELUE
 * (tv-core `openProfileState`) : nommé parent sur le bureau, il l'est ici sans
 * rouvrir son profil. Seul le profil du compte qui a jumelé la TV la
 * déjumelle. TV d'avant les profils : `profile` est nul, rien ne change.
 */
export function useProfileActions() {
  const { t } = useTranslation(["familyTv", "family"]);
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  // Relu à chaque retour sur l'écran : le pavé du code PIN vient de mettre le profil à jour,
  // la gestion a pu changer la famille — la liste se relit alors (rôle, gestion).
  const focused = useIsFocused();
  const away = useRef(false);
  useEffect(() => {
    if (!focused) {
      away.current = true;
      return;
    }
    if (!away.current) return;
    away.current = false;
    void queryClient.invalidateQueries({ queryKey: [...FAMILY_KEY] });
  }, [focused, queryClient]);
  const record = tvSessionMode(storage) === "profile" ? readProfileRecord(storage) : null;
  const listing = useTvFamilyListing();
  const kind = record?.kind ?? null;
  // Le compte de la TV (seul à la déjumeler) et le propriétaire de la famille : deux comptes en v2.
  const tvAccountName = record?.ownerName ?? "";
  const familyOwnerName = record?.familyOwnerName ?? tvAccountName;
  const color = record?.color ?? null;
  const state = record ? openProfileState(record, listing) : null;
  const known = state !== null;
  const role = state?.role ?? null;
  const manage = state?.manage ?? "none";
  const hasPin = state?.hasPin === true;
  const pairedTheTv = record ? recordPairedTheTv(record) : false;
  const launch = record?.launch ?? "picked";
  const alone = record ? profileAloneIn(listing, record.profileId) : null;

  const profile = useMemo<SettingsProfile | null>(() => {
    if (!kind || !color || !known) return null;
    return {
      // Aucun rôle (un compte sans famille, le compte de revue) : aucun libellé.
      role: role === null ? null : role === "owner" ? t("familyTv:settings.owner") : t(ROLE_KEYS[role], { owner: familyOwnerName }),
      color,
      canManage: manage === "manage",
      manageNeedsPin: manage === "needsPin",
      canUnpair: pairedTheTv,
      unpairCaption: pairedTheTv ? t("familyTv:settings.unpairCaption") : t("familyTv:settings.unpairOwnerOnly", { owner: tvAccountName }),
      // Le compte de démonstration : aucune entrée (`ownPinModesFor`).
      pin: { hasPin, modes: ownPinModesFor({ kind, hasPin, manage, launch, alone }) },
    };
  }, [kind, known, role, familyOwnerName, tvAccountName, color, manage, launch, alone, pairedTheTv, hasPin, t]);

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
