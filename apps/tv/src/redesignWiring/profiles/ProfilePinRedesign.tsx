import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setOwnFamilyPin, useTentacleConfig } from "@tentacle-tv/api-client";
import {
  PIN_ENTRY_START,
  erasePinDigit,
  ownPinCurrentRefused,
  ownPinEntered,
  ownPinStart,
  pinRefused,
  pressPinDigit,
  profilesEntryKey,
  readProfileRecord,
  writeProfileRecord,
  type OwnPinSubmit,
  type PinDigit,
  type PinEntry,
} from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { refusalOfError } from "../../auth/profileOpening";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { useProfilesFocus, useProfilesGroups } from "../../platform/tvos/screens/profiles";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { ProfilesView, type ProfilesViewModel } from "../../redesign/screens/profiles/ProfilesView";
import { useBackLayer } from "../back/BackScope";
import { pinMessageOf, profileAvatarUri, refusalMessage } from "./profilesModel";

type Props = NativeStackScreenProps<RootStackParamList, "ProfilePin">;

const STEP_KEYS = {
  current: { title: "familyTv:ownPin.stepCurrent", hint: "familyTv:ownPin.hintCurrent" },
  new: { title: "familyTv:ownPin.stepNew", hint: "familyTv:ownPin.hintNew" },
  confirm: { title: "familyTv:ownPin.stepConfirm", hint: "familyTv:ownPin.hintConfirm" },
} as const;

/**
 * SON code PIN depuis son profil (Réglages › Compte, Apple TV) : le pavé de
 * « Qui regarde ? », et les étapes de tv-core (`session/ownPin`) — l'actuel
 * d'abord s'il y en a un, le nouveau, sa confirmation. Le serveur juge
 * l'actuel (mêmes essais, même blocage) ; un code refusé se redemande. Le
 * code ne fait que transiter, dans le corps de l'appel. Enregistré : le
 * profil retenu suit (`hasPin`), et l'on revient aux réglages.
 */
export function ProfilePinRedesign({ navigation, route }: Props) {
  const { mode } = route.params;
  const { t, i18n } = useTranslation(["familyTv", "family"]);
  const { storage } = useTentacleConfig();
  const record = readProfileRecord(storage);
  const [flow, setFlow] = useState(() => ownPinStart(mode));
  const [entry, setEntry] = useState<PinEntry>(PIN_ENTRY_START);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  async function save(submit: OwnPinSubmit): Promise<void> {
    try {
      const { hasPin } = await setOwnFamilyPin(submit);
      const current = readProfileRecord(storage);
      if (current) writeProfileRecord(storage, { ...current, hasPin });
      if (alive.current) navigation.goBack();
    } catch (error) {
      if (!alive.current) return;
      const refusal = refusalOfError(error);
      if (refusal.kind === "pinInvalid" || refusal.kind === "locked") {
        setFlow((current) => ownPinCurrentRefused(current));
        setEntry((current) => pinRefused(current, refusal));
        setNote(null);
        return;
      }
      setFlow(ownPinStart(mode));
      setEntry(PIN_ENTRY_START);
      setNote(refusal.kind === "failed" && !refusal.code ? t("familyTv:ownPin.failed") : refusalMessage(refusal, t));
    }
  }

  const digit = (pressed: string) => {
    const { entry: next, submit } = pressPinDigit(entry, pressed as PinDigit);
    if (!submit) return setEntry(next);
    const step = ownPinEntered(flow, submit);
    setFlow(step.flow);
    setNote(null);
    if (step.submit) {
      setEntry(next);
      void save(step.submit);
    } else setEntry(PIN_ENTRY_START);
  };

  const serverUrl = storage.getItem("tentacle_server_url");
  const now = Date.now();
  const model = useMemo<ProfilesViewModel>(() => {
    const keys = STEP_KEYS[flow.step];
    const message = flow.mismatch ? t("familyTv:ownPin.mismatch") : (note ?? pinMessageOf(entry, i18n.language, now, t));
    return {
      kind: "pin",
      pad: {
        profile: {
          id: record?.profileId ?? "",
          name: record?.name ?? "",
          color: record?.color ?? "violet",
          avatarUri: record ? profileAvatarUri(serverUrl, record.profileId, record.imageTag) : undefined,
          hasPin: record?.hasPin ?? false,
          guest: false,
          lockedLabel: null,
        },
        title: t(keys.title),
        hint: t(keys.hint),
        typed: entry.digits.length,
        phase: entry.phase,
        message,
      },
    };
    // `now` relu à chaque rendu : un blocage se dit à jour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, entry, note, record?.profileId, record?.name, record?.color, record?.imageTag, record?.hasPin, serverUrl, i18n.language, t]);

  const store = useFocusStore();
  useProfilesGroups(store);
  const entryKey = profilesEntryKey({ phase: "pin", tileIndex: 0, pinLocked: entry.phase === "locked" });
  useProfilesFocus(store, { entryKey, arrival: `pin:${flow.step}` });
  useBackLayer("page", true, () => navigation.goBack());

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <ProfilesView model={model} onDigit={digit} onErase={() => setEntry((current) => erasePinDigit(current))} onBack={() => navigation.goBack()} />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
