import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFamilyCandidates, useFamilyLive, useFamilyOverview, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { FAMILY_PROFILE_COLORS } from "@tentacle-tv/shared";
import {
  MANAGE_BACK_KEY,
  STATUS_PRIMARY_KEY,
  manageActionRows,
  manageBackAction,
  manageEntryKey,
  manageFocusAfterRemoval,
  pinDigitKey,
  readProfileRecord,
  type ManageRowModel,
} from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { refusalOfError } from "../../auth/profileOpening";
import { leaveProfile } from "../../auth/profileSession";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { openPairingKeyboard } from "../../platform/tvos/screens/pairing";
import { useManageFocus, useManageGroups } from "../../platform/tvos/screens/profiles";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { KeyboardOpenerProvider } from "../../redesign/screens/pairing/keyboardOpener";
import { ManageProfilesView } from "../../redesign/screens/profiles/ManageProfilesView";
import { useBackLayer } from "../back/BackScope";
import { buildManageModel } from "./manageScreenModel";
import { SHOWN_CANDIDATES, candidateViews, freeColor, manageListModel } from "./manageModel";
import { useManageActions } from "./useManageActions";
import { useManageUnlock } from "./useManageUnlock";

type Props = NativeStackScreenProps<RootStackParamList, "ManageProfiles">;

/** Ce que l'entrée du focus lit de la liste : les deux gestes qui ajoutent, et les lignes qui portent un geste. */
function entryInputOf(list: ReturnType<typeof manageListModel> | null) {
  return {
    canCreateGuest: list?.capacity.canCreateGuest ?? false,
    canInvite: list?.capacity.canInvite ?? false,
    actionRows: list ? manageActionRows(list.rows) : [],
  };
}

/**
 * « Gérer les profils » de la refonte (Apple TV) — la session de qui gère
 * (le propriétaire, ou un membre avec SES droits — v2), gestion ouverte par le
 * serveur derrière SON PIN (`useManageUnlock`) : la
 * famille (`useFamilyOverview`, relue en direct par `useFamilyLive`), ses
 * gestes (`useManageActions`), ses deux pages. Venue de « Qui regarde ? »,
 * la sortie referme la session ouverte pour gérer et y ramène ; venue des
 * réglages, elle y revient (`manageBackAction`, tv-core).
 */
export function ManageProfilesRedesign({ navigation, route }: Props) {
  const origin = route.params?.origin ?? "settings";
  const { t, i18n } = useTranslation(["familyTv", "family", "common"]);
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const context = useMemo(() => ({ jfClient, storage, queryClient }), [jfClient, storage, queryClient]);
  const record = readProfileRecord(storage);
  const owner = useMemo(
    () => ({ userId: record?.profileId ?? "", name: record?.name ?? "", color: record?.color ?? FAMILY_PROFILE_COLORS[0] }),
    [record?.profileId, record?.name, record?.color],
  );
  const serverUrl = storage.getItem("tentacle_server_url");

  const unlock = useManageUnlock(origin, record?.hasPin === true);
  const ready = unlock.phase === "ready";
  const overview = useFamilyOverview({ enabled: ready });
  useFamilyLive({ token: storage.getItem("tentacle_token"), enabled: ready });

  const store = useFocusStore();
  useManageGroups(store);
  const pendingClaim = useRef<string | null>(null);
  // La liste de CE rendu, lue par le geste qui retire (il part après lui).
  const listRef = useRef<ReturnType<typeof manageListModel> | null>(null);
  const actions = useManageActions({
    onLocked: unlock.relock,
    onRemoved: (row: ManageRowModel) => {
      const current = listRef.current;
      const index = current?.rows.findIndex((candidate) => candidate.id === row.id) ?? -1;
      pendingClaim.current = current && index >= 0 ? manageFocusAfterRemoval({ view: "list", ...entryInputOf(current) }, index) : null;
    },
  });
  // Le droit d'un membre en cours d'envoi : sa case montre déjà le nouvel état.
  const list = overview.data ? manageListModel(overview.data, owner, serverUrl, i18n.language, t, actions.pendingRight) : null;
  listRef.current = list;
  const entryInput = entryInputOf(list);
  const candidates = useFamilyCandidates(actions.invite.search, { enabled: ready && actions.view === "invite" });

  // La gestion refermée pendant qu'on lisait la famille : elle se rouvre.
  useEffect(() => {
    if (overview.error && refusalOfError(overview.error).kind === "manageLocked") unlock.relock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview.error]);
  // Après un retrait, le focus va à la ligne qui prend la place, une fois la liste relue.
  useEffect(() => {
    if (!pendingClaim.current) return undefined;
    const key = pendingClaim.current;
    pendingClaim.current = null;
    return store.claim(key);
  }, [overview.data, store]);

  const model = buildManageModel({
    unlock, overview, list, actions, owner, t,
    candidates: candidates.data ? candidateViews(candidates.data, actions.invite.sent, serverUrl) : candidates.isError ? [] : null,
    more: (candidates.data?.length ?? 0) > SHOWN_CANDIDATES,
    language: i18n.language,
  });

  const entryKey =
    model.kind === "loading" ? null
      : model.kind === "error" ? STATUS_PRIMARY_KEY
        : model.kind === "pin" ? (unlock.entry.phase === "locked" ? MANAGE_BACK_KEY : pinDigitKey("1"))
          : manageEntryKey({ view: actions.view, ...entryInput, guestNamed: actions.guest.name.trim().length > 0 });
  useManageFocus(store, { entryKey, arrival: `${unlock.phase}:${actions.view}:${overview.data ? "data" : "none"}` });

  const exit = () => (origin === "profiles" ? leaveProfile(context, "switch") : navigation.goBack());
  const back = () => {
    if (!ready || manageBackAction(actions.view, origin) !== "toList") exit();
    else actions.toList();
  };
  useBackLayer("page", true, back);

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <KeyboardOpenerProvider value={openPairingKeyboard}>
          <ManageProfilesView
            model={model}
            onBack={back}
            onRetry={ready ? () => void overview.refetch() : unlock.retry}
            onCreateGuest={() => actions.openGuest(freeColor(overview.data, FAMILY_PROFILE_COLORS))}
            onInvite={actions.openInvite}
            onRowAction={(id) => {
              const row = list?.rows.find((candidate) => candidate.id === id);
              if (row) actions.rowPress(row);
            }}
            onRowBlur={actions.rowBlur}
            onRowRight={(id) => {
              const row = list?.rows.find((candidate) => candidate.id === id);
              if (row) void actions.toggleRight(row);
            }}
            onGuestName={actions.setGuestName}
            onGuestColor={actions.setGuestColor}
            onGuestSubmit={() => void actions.submitGuest()}
            onQuery={actions.setQuery}
            onSearch={actions.searchNow}
            onInviteCandidate={(id) => {
              const candidate = candidates.data?.find((entry) => entry.userId === id);
              if (candidate) void actions.sendInvite(candidate.userId, candidate.name);
            }}
            onDigit={unlock.digit}
            onErase={unlock.erase}
          />
        </KeyboardOpenerProvider>
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
