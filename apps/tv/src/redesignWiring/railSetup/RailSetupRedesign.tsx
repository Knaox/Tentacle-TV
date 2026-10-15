import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  railSetupAfterContinue,
  railSetupApplyDue,
  railSetupApplyEntryKey,
  railSetupBackAction,
  railSetupEntryKey,
  toggleRailSetupTarget,
  type RailSetupStep,
} from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { useRailSetupEntry, useRailSetupGroups } from "../../platform/tvos/screens/railSetup";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { RailSetupView, type RailSetupModel } from "../../redesign/screens/railSetup/RailSetupView";
import { useBackLayer } from "../back/BackScope";
import { useTvFamilyListing } from "../profiles/useTvFamilyListing";
import { useRailSetupEditor } from "./useRailSetupEditor";
import { useRailSetupGate } from "./useRailSetupGate";
import { useRailSetupTargets } from "./useRailSetupTargets";

type Props = NativeStackScreenProps<RootStackParamList, "RailSetup">;

/**
 * La PRÉCONFIGURATION de la barre (Apple TV et Android TV) : une route posée
 * AVANT l'accueil — après le jumelage, à l'ouverture d'un profil, au
 * démarrage quand elle n'a jamais été faite (`routeAfterSession`, tv-core).
 *
 * - La porte du socle (`useRailSetupGate`) décide : `wait`, rien ne paraît
 *   (ni la page, ni l'accueil — l'attente est bornée par le socle, hors ligne
 *   compris) ; `skip`, l'accueil sans rien marquer ; `show`, la page, tenue
 *   jusqu'au choix du profil.
 * - « Continuer » enregistre (`complete`), puis l'étape du propriétaire si
 *   d'autres profils vivent sur cette TV (`useRailSetupTargets`) ; « Passer »
 *   et Retour gardent la disposition d'avant (`skip`). Jamais une impasse.
 * - Depuis Réglages › Navigation (`origin: "settings"`) : l'étape du
 *   propriétaire seule ; la sortie revient aux réglages.
 *
 * Le focus : décidé par tv-core (`nav/railSetupScreen`, `nav/railSetupApply`),
 * posé par l'applicateur `platform/tvos/screens/railSetup.ts`.
 */
export function RailSetupRedesign({ navigation, route }: Props) {
  const origin = route.params?.origin ?? "session";
  const gate = useRailSetupGate();
  const { targets, apply } = useRailSetupTargets();
  const listing = useTvFamilyListing();
  const [step, setStep] = useState<RailSetupStep>(origin === "settings" ? "apply" : "libraries");
  const [selected, setSelected] = useState<string[]>([]);
  const store = useFocusStore();
  useRailSetupGroups(store);
  const editor = useRailSetupEditor(store, gate.layout);

  // Une seule sortie : la page part une fois, quel que soit le geste.
  const left = useRef(false);
  const finish = useCallback(() => {
    if (left.current) return;
    left.current = true;
    if (origin === "settings") navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: "Home", params: { entrance: true } }] });
  }, [navigation, origin]);

  // La porte dit « pas maintenant » (déjà faite, moins de deux bibliothèques, hors ligne) : l'accueil.
  const skipped = origin === "session" && step === "libraries" && gate.status === "skip";
  useEffect(() => {
    if (skipped) finish();
  }, [skipped, finish]);
  // Les réglages n'ouvrent l'étape que pour le propriétaire : sans cible, rien à faire ici.
  const noTarget = origin === "settings" && listing !== null && targets.length === 0;
  useEffect(() => {
    if (noTarget) finish();
  }, [noTarget, finish]);

  const onContinue = useCallback(() => {
    gate.complete(editor.layout);
    if (railSetupAfterContinue(railSetupApplyDue(targets.length)) === "apply") setStep("apply");
    else finish();
  }, [gate, editor.layout, targets.length, finish]);
  const onSkip = useCallback(() => {
    gate.skip();
    finish();
  }, [gate, finish]);
  const targetIds = useMemo(() => targets.map((target) => target.userId), [targets]);
  const onToggleTarget = useCallback(
    (userId: string) => setSelected((current) => toggleRailSetupTarget(current, userId, targetIds)),
    [targetIds],
  );
  const onApply = useCallback(() => {
    apply(selected);
    finish();
  }, [apply, selected, finish]);

  const { cancelMove } = editor;
  const moving = editor.movingKey !== null;
  const onBack = useCallback(() => {
    switch (railSetupBackAction(step, moving)) {
      case "cancelMove":
        cancelMove();
        return;
      case "skip":
        onSkip();
        return;
      case "decline":
        finish();
    }
  }, [step, moving, cancelMove, onSkip, finish]);
  useBackLayer("page", true, onBack);

  const profileName = useMemo(() => {
    const profiles = listing?.profiles ?? [];
    return profiles.length > 1 ? (profiles.find((profile) => profile.userId === gate.identity)?.name ?? null) : null;
  }, [listing, gate.identity]);

  const model = useMemo<RailSetupModel>(() => {
    if (step === "apply") {
      return {
        kind: "apply",
        origin: origin === "settings" ? "settings" : "setup",
        targets: targets.map(({ userId, name, color, avatarUri, setupDone }) => ({
          userId, name, color, avatarUri, setupDone, selected: selected.includes(userId),
        })),
        busy: false,
      };
    }
    if (gate.status !== "show") return { kind: "waiting" };
    return { kind: "libraries", profileName, libraries: editor.libraries, movingKey: editor.movingKey, preview: editor.preview };
  }, [step, origin, targets, selected, gate.status, profileName, editor.libraries, editor.movingKey, editor.preview]);

  const entryKey =
    model.kind === "libraries" ? railSetupEntryKey(model.libraries.length) : model.kind === "apply" ? railSetupApplyEntryKey(model.targets.length) : null;
  useRailSetupEntry(store, entryKey);

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <RailSetupView
          model={model}
          onTogglePin={editor.togglePin}
          onMove={editor.move}
          onContinue={onContinue}
          onSkip={onSkip}
          onToggleTarget={onToggleTarget}
          onApply={onApply}
          onDecline={finish}
        />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
