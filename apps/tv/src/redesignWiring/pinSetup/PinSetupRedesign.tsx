import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { pinSetupBackAction, pinSetupEntry, pinSetupReason, pinSetupSubjectOf, readProfileRecord } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { startupRouteAfter, startupStackRoute } from "../../navigation/startupWindows";
import { declinePinSetup, pinSetupPending } from "../../auth/pinSetupStep";
import { useServerReachability } from "../../hooks/serverReachability";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { usePinSetupEntry, usePinSetupGroups } from "../../platform/tvos/screens/pinSetup";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { PinSetupView, type PinSetupModel } from "../../redesign/screens/pinSetup/PinSetupView";
import { useBackLayer } from "../back/BackScope";
import { profileAvatarUri } from "../profiles/profilesModel";

type Props = NativeStackScreenProps<RootStackParamList, "PinSetup">;

/**
 * Le CODE PIN CONSEILLÉ du premier passage dans un profil (Apple TV et
 * Android TV) : la PREMIÈRE fenêtre du registre ordonné du démarrage (tv-core
 * `nav/startupWindows`, `navigation/startupWindows`), avant la barre et la
 * photo ; fermée, elle cède à la suivante, sinon à l'accueil.
 *
 * - Tranchée à l'arrivée, une fois (tv-core `pinSetupEntry`) : plus en
 *   attente ou hors ligne, la page cède aussitôt la place, sans rien marquer.
 * - « Créer un code PIN » ouvre le pavé de SON code (`ProfilePin`, le même
 *   que Réglages › Compte, `origin: "startup"`) : Retour y ramène ici ; le
 *   code enregistré, c'est le pavé qui passe à la fenêtre suivante.
 * - « Plus tard » et Retour marquent l'étape pour ce profil sur cet appareil
 *   (`declinePinSetup`) : elle ne reviendra plus.
 */
export function PinSetupRedesign({ navigation }: Props) {
  const { storage } = useTentacleConfig();
  const [record] = useState(() => readProfileRecord(storage));
  const { reachable } = useServerReachability();
  const [entry] = useState(() => pinSetupEntry({ pending: pinSetupPending(), online: reachable }));

  // Une seule sortie : la page part une fois, quel que soit le geste.
  const left = useRef(false);
  const finish = useCallback(() => {
    if (left.current) return;
    left.current = true;
    navigation.reset({ index: 0, routes: [startupStackRoute(startupRouteAfter("pinSetup"))] });
  }, [navigation]);
  useEffect(() => {
    if (entry === "skip") finish();
  }, [entry, finish]);

  const onLater = useCallback(() => {
    declinePinSetup();
    finish();
  }, [finish]);
  const onCreate = useCallback(() => navigation.navigate("ProfilePin", { mode: "create", origin: "startup" }), [navigation]);
  const onBack = useCallback(() => {
    if (pinSetupBackAction() === "later") onLater();
  }, [onLater]);
  useBackLayer("page", true, onBack);

  const serverUrl = storage.getItem("tentacle_server_url");
  const model = useMemo<PinSetupModel>(() => {
    if (entry !== "show" || !record) return { kind: "waiting" };
    return {
      kind: "offer",
      profile: { name: record.name, color: record.color, avatarUri: profileAvatarUri(serverUrl, record.profileId, record.imageTag) },
      reason: pinSetupReason(pinSetupSubjectOf(record)),
    };
  }, [entry, record, serverUrl]);

  const store = useFocusStore();
  usePinSetupGroups(store);
  const focused = useIsFocused();
  usePinSetupEntry(store, model.kind === "offer" && focused);

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <PinSetupView model={model} onCreate={onCreate} onLater={onLater} />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
