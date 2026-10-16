import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setOwnFamilyPin, useTentacleConfig } from "@tentacle-tv/api-client";
import {
  PIN_ENTRY_START,
  PIN_SETUP_SAVED_HOLD_MS,
  erasePinDigit,
  ownPinCurrentRefused,
  ownPinEntered,
  ownPinStart,
  pinRefused,
  pressPinDigit,
  profilesEntryKey,
  profilesEntryRound,
  readProfileRecord,
  writeProfileRecord,
  type OwnPinSubmit,
  type PinDigit,
  type PinEntry,
} from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { startupRouteAfter, startupStackRoute } from "../../navigation/startupWindows";
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
 *
 * Ouvert par l'étape « Code PIN conseillé » du premier passage (`origin:
 * "startup"`) : enregistré, le pavé dit « Code PIN enregistré » le temps de
 * le lire (touches muettes), puis passe à la fenêtre suivante du démarrage —
 * Retour, pendant ce temps, y passe tout de suite.
 */
export function ProfilePinRedesign({ navigation, route }: Props) {
  const { mode, origin } = route.params;
  const { t, i18n } = useTranslation(["familyTv", "family"]);
  const { storage } = useTentacleConfig();
  const record = readProfileRecord(storage);
  const [flow, setFlow] = useState(() => ownPinStart(mode));
  const [entry, setEntry] = useState<PinEntry>(PIN_ENTRY_START);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  // L'étape du premier passage : le code enregistré, la fenêtre suivante du démarrage.
  const nextWindow = useCallback(
    () => navigation.reset({ index: 0, routes: [startupStackRoute(startupRouteAfter("pinSetup"))] }),
    [navigation],
  );
  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(nextWindow, PIN_SETUP_SAVED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [saved, nextWindow]);

  async function save(submit: OwnPinSubmit): Promise<void> {
    try {
      const { hasPin } = await setOwnFamilyPin(submit);
      const current = readProfileRecord(storage);
      if (current) writeProfileRecord(storage, { ...current, hasPin });
      if (!alive.current) return;
      if (origin !== "startup") return navigation.goBack();
      setSaved(true);
      setEntry((current) => ({ ...current, phase: "typing" }));
      setNote(t("familyTv:pinSetup.saved"));
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
    if (saved) return;
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
  const entryInput = { phase: "pin" as const, tileIndex: 0, pinLocked: entry.phase === "locked", pinRestarts: flow.restarts };
  // « Les deux codes diffèrent » : la saisie reprend de zéro, le focus au premier chiffre (`profilesEntryRound`).
  useProfilesFocus(store, { entryKey: profilesEntryKey(entryInput), arrival: `pin:${flow.step}`, round: profilesEntryRound(entryInput) });
  const back = () => (saved ? nextWindow() : navigation.goBack());
  useBackLayer("page", true, back);

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <ProfilesView model={model} onDigit={digit} onErase={() => !saved && setEntry((current) => erasePinDigit(current))} onBack={back} />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
