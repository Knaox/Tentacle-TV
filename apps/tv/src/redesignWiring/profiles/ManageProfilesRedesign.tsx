import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { useFamilyCandidates, useFamilyOverview, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { FAMILY_PROFILE_COLORS } from "@tentacle-tv/shared";
import {
  INVITE_SEARCH_KEY,
  manageActionRows,
  manageBackAction,
  manageFocusAfterRemoval,
  readProfileRecord,
  type ManageRowModel,
  type ManageView,
} from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { refusalOfError } from "../../auth/profileOpening";
import { leaveProfile } from "../../auth/profileSession";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { useGuestColorsEntry, useManageFocus, useManageGroups } from "../../platform/tvos/screens/profiles";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { KeyboardEntryProvider } from "../../redesign/screens/pairing/keyboardOpener";
import { ManageProfilesView } from "../../redesign/screens/profiles/ManageProfilesView";
import { useBackLayer } from "../back/BackScope";
import { useHiddenKeyboard } from "../pairing/useHiddenKeyboard";
import { manageEntryOf } from "./manageEntry";
import { SHOWN_CANDIDATES, candidateViews, freeColor, manageListModel } from "./manageModel";
import { openGuestPhoto, openParental } from "./manageRoutes";
import { buildManageModel } from "./manageScreenModel";
import { useManageActions } from "./useManageActions";
import { useManageCapability } from "./useManageCapability";
import { useManageSheet } from "./useManageSheet";
import { isManagePinRequired, useManageUnlock } from "./useManageUnlock";
import { useTvFamilyListing } from "./useTvFamilyListing";

type Props = NativeStackScreenProps<RootStackParamList, "ManageProfiles">;
type ManageList = ReturnType<typeof manageListModel>;

/** Ce que le retour du focus lit de la liste : les deux gestes qui ajoutent, et les lignes qui prennent le focus. */
function entryInputOf(list: ManageList | null) {
  return {
    canCreateGuest: list?.capacity.canCreateGuest ?? false,
    canInvite: list?.capacity.canInvite ?? false,
    actionRows: list ? manageActionRows(list.rows) : [],
  };
}

/**
 * « Gérer les profils » de la refonte (Apple TV, Android TV) — la session de
 * qui gère (le propriétaire, un parent, un membre — chacun avec SES droits),
 * derrière SON code (`useManageUnlock` : la famille d'abord, le pavé sur
 * `manage_locked`) : la famille (`useFamilyOverview`, relue en direct par
 * `TVFamilyLive`), ses pages (`useManageActions`), la fiche de chaque profil
 * (`useManageSheet`). Venue de « Qui regarde ? », la sortie referme la
 * session ouverte pour gérer et y ramène ; venue des réglages, elle y revient
 * (`manageBackAction`, tv-core).
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
    () => ({
      userId: record?.profileId ?? "",
      name: record?.name ?? "",
      color: record?.color ?? FAMILY_PROFILE_COLORS[0],
      imageTag: record?.imageTag ?? null,
    }),
    [record?.profileId, record?.name, record?.color, record?.imageTag],
  );
  const serverUrl = storage.getItem("tentacle_server_url");

  const unlock = useManageUnlock();
  const unlockRef = useRef(unlock);
  unlockRef.current = unlock;
  const ready = unlock.phase === "ready";
  const overview = useFamilyOverview({ enabled: ready });
  // Les portraits que « Qui regarde ? » connaît : le relais d'un aperçu lu pendant que Jellyfin ne répondait pas.
  const listing = useTvFamilyListing();
  const capability = useManageCapability(ready, navigation);

  const store = useFocusStore();
  const keyboardEntry = useHiddenKeyboard(store);
  useManageGroups(store);
  const pendingClaim = useRef<string | null>(null);
  // La liste de CE rendu, lue par le geste qui retire (il part après lui).
  const listRef = useRef<ManageList | null>(null);
  const actions = useManageActions({
    onLocked: unlock.relock,
    onNeedsPin: unlock.needsPin,
    onRemoved: (row: ManageRowModel) => {
      const current = listRef.current;
      const index = current?.rows.findIndex((candidate) => candidate.id === row.id) ?? -1;
      pendingClaim.current = current && index >= 0 ? manageFocusAfterRemoval({ view: "list", ...entryInputOf(current) }, index) : null;
    },
  });
  const list = overview.data ? manageListModel(overview.data, owner, serverUrl, i18n.language, t, capability, listing?.profiles) : null;
  listRef.current = list;
  const sheetRow = list?.rows.find((row) => row.id === actions.sheetId) ?? null;
  const sheet = useManageSheet({
    row: sheetRow,
    actions,
    onPhoto: (row) => openGuestPhoto(navigation, row),
    onParental: (row) => openParental(navigation, row),
  });
  // La dernière page quittée (créer un invité, inviter, une fiche) : de retour sur la liste, le focus rejoint ce qui l'a ouverte.
  const lastPage = useRef<ManageView | null>(null);
  if (actions.view !== "list") lastPage.current = actions.view;
  const sheetIndex = list && actions.sheetId ? list.rows.findIndex((row) => row.id === actions.sheetId) : -1;
  const returnRow = useRef<number | null>(null);
  if (sheetIndex >= 0) returnRow.current = sheetIndex;
  const candidates = useFamilyCandidates(actions.invite.search, { enabled: ready && actions.view === "invite" });

  // La gestion fermée (pas encore ouverte, ou refermée en route) : le pavé ; sans code : l'invitation à en poser un.
  useEffect(() => {
    if (!overview.error) return;
    const refusal = refusalOfError(overview.error);
    if (refusal.kind === "manageLocked") unlockRef.current.relock();
    else if (isManagePinRequired(refusal)) unlockRef.current.needsPin();
  }, [overview.error]);
  // Revenu de « Créer un code PIN » : la famille se relit, le serveur dira la suite.
  const focused = useIsFocused();
  const away = useRef(false);
  useEffect(() => {
    if (!focused) {
      away.current = true;
      return;
    }
    if (!away.current) return;
    away.current = false;
    if (unlockRef.current.phase === "needsPin") unlockRef.current.retry();
  }, [focused]);
  // Une fiche dont le profil a disparu (retiré ailleurs, relu en direct) : la liste.
  const sheetGone = list !== null && (actions.view === "profile" || actions.view === "guestPin") && sheetRow === null;
  const toList = actions.toList;
  useEffect(() => {
    if (sheetGone) toList();
  }, [sheetGone, toList]);
  // Après un retrait, le focus va à la ligne qui prend la place, une fois la liste relue.
  useEffect(() => {
    if (!pendingClaim.current) return undefined;
    const key = pendingClaim.current;
    pendingClaim.current = null;
    return store.claim(key);
  }, [overview.data, store]);

  const model = buildManageModel({
    unlock, overview, list, actions, owner, t, sheetRow, sheet, serverUrl,
    candidates: candidates.data ? candidateViews(candidates.data, actions.invite.sent, serverUrl) : candidates.isError ? [] : null,
    more: (candidates.data?.length ?? 0) > SHOWN_CANDIDATES,
    language: i18n.language,
  });

  const entryKey = manageEntryOf(model.kind, {
    unlockLocked: unlock.entry.phase === "locked",
    pinLocked: sheet.pin.entry.phase === "locked",
    input: { view: actions.view, ...entryInputOf(list), guestNamed: actions.guest.name.trim().length > 0, returnFrom: lastPage.current, returnRow: returnRow.current },
    gestures: sheetRow?.gestures ?? [],
    lastSheetKey: sheet.lastKey.current,
  });
  useManageFocus(store, { entryKey, arrival: `${unlock.phase}:${actions.view}:${actions.sheetId ?? ""}:${overview.data ? "data" : "none"}` });
  useGuestColorsEntry(store, actions.view === "guest" ? actions.guest.color : null);

  // Venue de « Qui regarde ? » : la session ouverte pour gérer se referme, et le focus y revient sur « Gérer les profils ».
  const exit = () => (origin === "profiles" ? leaveProfile(context, "switch", { returnTo: "manage" }) : navigation.goBack());
  const back = () => {
    const action = ready ? manageBackAction(actions.view, origin, store.focusedKey()) : null;
    // Depuis un résultat de la recherche : la recherche d'abord (tv-core `manageBackAction`).
    if (action === "toSearch") store.claim(INVITE_SEARCH_KEY);
    else if (action === "toSheet") actions.toSheet();
    else if (action === "toList") {
      sheet.reset();
      actions.toList();
    } else exit();
  };
  useBackLayer("page", true, back);
  const findRow = (id: string) => list?.rows.find((candidate) => candidate.id === id);

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <KeyboardEntryProvider value={keyboardEntry}>
          <ManageProfilesView
            model={model}
            onBack={back}
            onRetry={ready ? () => void overview.refetch() : unlock.retry}
            onCreateGuest={() => actions.openGuest(freeColor(overview.data, FAMILY_PROFILE_COLORS))}
            onInvite={actions.openInvite}
            onRowAction={(id) => {
              const row = findRow(id);
              if (!row) return;
              if (row.kind !== "invitation") sheet.reset();
              actions.rowPress(row);
            }}
            onRowBlur={actions.rowBlur}
            onSheetRow={sheet.press}
            onSheetRowBlur={sheet.blur}
            onGuestName={actions.setGuestName}
            onGuestColor={actions.setGuestColor}
            onGuestSubmit={() => void actions.submitGuest()}
            onQuery={actions.setQuery}
            onSearch={actions.searchNow}
            onInviteCandidate={(id) => {
              const candidate = candidates.data?.find((entry) => entry.userId === id);
              if (candidate) void actions.sendInvite(candidate.userId, candidate.name);
            }}
            onDigit={model.kind === "guestPin" ? sheet.digit : unlock.digit}
            onErase={model.kind === "guestPin" ? sheet.erase : unlock.erase}
            onCreatePin={() => navigation.navigate("ProfilePin", { mode: "create" })}
          />
        </KeyboardEntryProvider>
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
