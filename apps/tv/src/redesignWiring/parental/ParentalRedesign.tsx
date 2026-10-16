import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  FAMILY_KEY,
  useFamilyOverview,
  useFamilyParentalOptions,
  useServerCapability,
  useSetFamilyGuestParental,
  useSetFamilyMemberParental,
  useTentacleConfig,
} from "@tentacle-tv/api-client";
import { GUEST_PARENTAL_NONE, sameUserId, type GuestParentalControls } from "@tentacle-tv/shared";
import { STATUS_PRIMARY_KEY, parentalAgeOptionKey, parentalEntryKey, withParentalAge } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { refusalOfError } from "../../auth/profileOpening";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { useParentalFocus, useParentalGroups } from "../../platform/tvos/screens/parental";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { ParentalView, type ParentalViewModel } from "../../redesign/screens/parental/ParentalView";
import { useBackLayer } from "../back/BackScope";
import { profileAvatarUri, refusalMessage } from "../profiles/profilesModel";
import { parentalAgeView } from "./parentalModel";
import { useParentalLibraries } from "./useParentalLibraries";
import { useParentalNotice } from "./useParentalNotice";
import { useSaveLane } from "./useSaveLane";

type Props = NativeStackScreenProps<RootStackParamList, "ParentalControls">;

/**
 * Le CONTRÔLE PARENTAL simplifié d'un profil (Apple TV et Android TV), ouvert
 * depuis « Gérer les profils » sur un invité ou un membre mineur, par qui gère
 * (le propriétaire, un parent, le membre pour SES invités — gestion ouverte par
 * SON code). L'état voyage avec la famille (`GET /api/family` : `parental`,
 * `parentalCeiling`, rendus à qui peut régler ce profil) ; l'échelle de
 * Jellyfin vient de `parentalOptions`. Chaque palier part aussitôt
 * (`setGuestParental` / `setMemberParental`, le contrôle ENTIER : seule la note
 * change), file après file (`useSaveLane`) ; chaque bibliothèque aussi
 * (`useParentalLibraries`).
 *
 * Gardé par les capacités : l'âge d'un invité par `family.parentalControls`,
 * celui d'un membre par `family.memberParental`, les bibliothèques par
 * `family.libraryLimits` — sans elle, leur section n'existe pas. La gestion refermée en route
 * (`family.manage_locked`) : retour à « Gérer les profils », qui redemande le code.
 */
export function ParentalRedesign({ navigation, route }: Props) {
  const { userId } = route.params;
  const { t } = useTranslation(["parentalTv", "familyTv", "family", "common"]);
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const serverUrl = storage.getItem("tentacle_server_url");
  const store = useFocusStore();
  useParentalGroups(store);

  const overview = useFamilyOverview();
  const profile = useMemo(
    () => overview.data?.family?.profiles.find((candidate) => sameUserId(candidate.userId, userId)) ?? null,
    [overview.data, userId],
  );
  const guestAge = useServerCapability("family.parentalControls");
  const memberAge = useServerCapability("family.memberParental");
  const ageAllowed = !!profile?.parental && (profile.kind === "guest" ? guestAge : memberAge);
  const options = useFamilyParentalOptions({ enabled: ageAllowed });
  // Le serveur ne rend l'état parental qu'à qui peut régler ce profil : les bibliothèques suivent les mêmes droits.
  const librariesAllowed = useServerCapability("family.libraryLimits") && !!profile?.parental;

  const leave = useCallback(() => navigation.goBack(), [navigation]);
  const onLocked = useCallback(() => {
    // « Gérer les profils », dessous, relit la famille et redemande le code.
    void queryClient.invalidateQueries({ queryKey: [...FAMILY_KEY] });
    navigation.goBack();
  }, [navigation, queryClient]);
  const notice = useParentalNotice((error) => {
    const refusal = refusalOfError(error);
    if (refusal.kind === "manageLocked") {
      onLocked();
      return null;
    }
    return refusalMessage(refusal, t);
  });

  const guestParental = useSetFamilyGuestParental();
  const memberParental = useSetFamilyMemberParental();
  const sendAge = useCallback(
    (parental: GuestParentalControls) =>
      profile?.kind === "guest" ? guestParental.mutateAsync({ userId, parental }) : memberParental.mutateAsync({ userId, parental }),
    [profile?.kind, guestParental, memberParental, userId],
  );
  const ageLane = useSaveLane(sendAge, notice.report, profile?.parental);
  const libraries = useParentalLibraries({ userId, enabled: librariesAllowed, report: notice.report, say: notice.say });

  const age = useMemo(() => {
    if (!ageAllowed || !profile || !options.data) return null;
    return parentalAgeView({
      controls: ageLane.value ?? profile.parental ?? { ...GUEST_PARENTAL_NONE },
      ceiling: profile.parentalCeiling ?? null,
      ratings: options.data.parentalRatings,
      kind: profile.kind,
      creatorName: profile.createdByName,
      t,
    });
  }, [ageAllowed, profile, options.data, ageLane.value, t]);

  const onAge = useCallback(
    (key: string) => {
      const choice = age?.choices.find((candidate) => candidate.key === key);
      // Le réglage fait ailleurs se garde tel quel : OK dessus ne change rien.
      if (!choice || !profile || key === age?.selectedKey) return;
      ageLane.push(withParentalAge(ageLane.value ?? profile.parental ?? { ...GUEST_PARENTAL_NONE }, choice));
    },
    [age, profile, ageLane],
  );

  const currentNotice = notice.current;
  // Lu sur les données (la TV tourne sur react-query v4 : `isLoading` n'y dit pas la même chose).
  const loading = (!overview.data && !overview.error) || (ageAllowed && !options.data && !options.error) || libraries.loading;
  const failure = overview.error ?? (ageAllowed ? options.error : null) ?? libraries.error;
  const model = useMemo<ParentalViewModel>(() => {
    if (loading) return { kind: "loading" };
    if (failure) return { kind: "error", message: refusalMessage(refusalOfError(failure), t), retry: true };
    if (!profile) return { kind: "error", message: t("familyTv:unavailable"), retry: false };
    if (!age && !libraries.view) return { kind: "error", message: t("parentalTv:unavailable"), retry: false };
    return {
      kind: "ready",
      name: profile.name,
      color: profile.color,
      avatarUri: profileAvatarUri(serverUrl, profile.userId, profile.imageTag),
      role: profile.kind === "guest" ? t("parentalTv:roles.guest") : t("parentalTv:roles.member"),
      age: age?.view ?? null,
      libraries: libraries.view,
      notice: currentNotice,
    };
  }, [loading, failure, profile, age, libraries.view, serverUrl, currentNotice, t]);

  // L'entrée : décidée à l'ARRIVÉE (le palier alors retenu), jamais reprise à chaque geste.
  const [entry, setEntry] = useState<string | null>(null);
  const arrivedEntry =
    model.kind === "ready" ? parentalEntryKey({ ageKey: age?.selectedKey ?? null, libraryCount: libraries.view?.rows.length ?? 0 }) : null;
  if (entry === null && arrivedEntry !== null) setEntry(arrivedEntry);
  const entryKey = model.kind === "error" ? (model.retry ? STATUS_PRIMARY_KEY : null) : entry;
  useParentalFocus(store, {
    entryKey,
    arrival: model.kind,
    agesEntry: age ? parentalAgeOptionKey(age.selectedKey) : null,
  });
  useBackLayer("page", true, leave);

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <ParentalView
          model={model}
          onBack={leave}
          onRetry={() => {
            void overview.refetch();
            if (ageAllowed) void options.refetch();
            if (librariesAllowed) void libraries.refetch();
          }}
          onAge={onAge}
          onLibrary={libraries.onLibrary}
        />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
