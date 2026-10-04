import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { findProfile, pickerEntryIndex, profilesBackAction, profilesEntryKey } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { useProfilesFocus, useProfilesGroups } from "../../platform/tvos/screens/profiles";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { ProfilesView, type ProfilesViewModel } from "../../redesign/screens/profiles/ProfilesView";
import { lastLeftProfileId } from "../../auth/profileSession";
import { useBackLayer } from "../back/BackScope";
import { pinMessageOf, refusalMessage, tileModelOf } from "./profilesModel";
import { useProfilesFlow } from "./useProfilesFlow";

type Props = NativeStackScreenProps<RootStackParamList, "Profiles">;

/**
 * « Qui regarde ? » de la refonte (Apple TV) : l'automate (`useProfilesFlow`)
 * rendu par `ProfilesView`. Le focus, que la vue ne décide pas : l'entrée de
 * chaque phase (`profilesEntryKey`, tv-core) — le profil qu'on vient de
 * quitter, le premier chiffre du pavé, « Réessayer » —, la rangée et ses
 * actions en guides qui mémorisent, la croix du pavé reverrouillée à chaque
 * arrivée. Menu : le pavé recule vers les profils ; sur la rangée, il reste à
 * UIKit, qui quitte l'application (`profilesBackAction`) — « Qui regarde ? »
 * est toujours la seule page de la pile.
 */
export function ProfilesRedesign({ navigation, route }: Props) {
  const { t, i18n } = useTranslation(["familyTv", "family", "pairing", "common"]);
  const { storage } = useTentacleConfig();
  const go = useMemo(
    () => ({
      home: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }),
      manage: () => navigation.reset({ index: 0, routes: [{ name: "ManageProfiles", params: { origin: "profiles" } }] }),
    }),
    [navigation],
  );
  const flow = useProfilesFlow(route.params?.intent ?? "launch", go);
  const { listing, phase, remember, notice, entry, unpairArmed } = flow;

  const now = Date.now();
  const serverUrl = storage.getItem("tentacle_server_url");
  const model = useMemo<ProfilesViewModel>(() => {
    if (phase.kind === "loading") {
      return { kind: "loading", label: phase.opening ? t("familyTv:opening", { name: phase.opening }) : t("familyTv:loading") };
    }
    if (phase.kind === "error") {
      return {
        kind: "error",
        message: refusalMessage(phase.refusal, t),
        secondary: { label: unpairArmed ? t("pairing:tvUnpairConfirm") : t("pairing:tvUnpairDevice"), armed: unpairArmed },
      };
    }
    const profiles = (listing?.profiles ?? []).map((profile) => tileModelOf(profile, serverUrl, now, i18n.language, t));
    const pinned = phase.kind === "pin" && listing ? findProfile(listing, phase.profileId) : null;
    const tile = pinned ? profiles.find((candidate) => candidate.id === pinned.userId) : undefined;
    if (phase.kind === "pin" && tile) {
      const manage = phase.purpose === "manage";
      return {
        kind: "pin",
        pad: {
          profile: tile,
          title: t(manage ? "familyTv:pin.manageTitle" : "familyTv:pin.title", { name: tile.name }),
          hint: manage ? t("familyTv:pin.manageHint") : null,
          typed: entry.digits.length,
          phase: entry.phase,
          message: pinMessageOf(entry, i18n.language, now, t),
        },
      };
    }
    return {
      kind: "picker",
      profiles,
      remember,
      canManage: listing?.canManage === true,
      notice: notice ? refusalMessage(notice, t) : null,
    };
    // `now` relu à chaque rendu : un blocage se dit à jour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, listing, remember, notice, entry, unpairArmed, serverUrl, i18n.language, t]);

  const store = useFocusStore();
  useProfilesGroups(store);
  const tileIndex = listing ? pickerEntryIndex(listing, lastLeftProfileId()) : 0;
  const entryKey = profilesEntryKey({ phase: phase.kind, tileIndex, pinLocked: entry.phase === "locked" });
  useProfilesFocus(store, { entryKey, arrival: phase.kind });

  const back = profilesBackAction(phase.kind);
  const { closePin } = flow;
  useBackLayer("page", back === "closePin", closePin);

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <ProfilesView
          model={model}
          onRetry={flow.retry}
          onErrorSecondary={flow.unpairFromError}
          onPick={flow.pick}
          onToggleRemember={flow.toggleRemember}
          onManage={flow.manage}
          onDigit={flow.digit}
          onErase={flow.erase}
          onBack={closePin}
        />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
