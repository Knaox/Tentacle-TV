import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { reportAccountAccess, useAccountAccess, useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import {
  ACCOUNT_ACCESS_SCREEN,
  ACCOUNT_ACCESS_SCREEN_FOCUS,
  ACCOUNT_ACCESS_SCREEN_KEYS,
  accountAccessEntry,
  decideAccountAccessScreen,
  readProfileRecord,
  recordPairedTheTv,
  tvSessionMode,
  type AccountAccessScreenAction,
  type AccountAccessScreenDecision,
} from "@tentacle-tv/tv-core";
import { accountAccessView, type AccountAccessBlocked } from "@tentacle-tv/shared";
import { AccountAccessOverlay } from "../../redesign/screens/overlays/AccountAccessOverlay";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { TrapFocusGuide } from "../../platform/tvos/focus/focusGuides";
import { useKeepFocusWithin } from "../../platform/tvos/focus/useKeepFocusWithin";
import { useExitOnBack } from "../../platform/backScope";
import { navigationRef } from "../../navigation/navigationRef";
import { useUnpairDevice } from "../../hooks/useUnpairDevice";
import { switchProfile } from "../../auth/profileSession";

/**
 * La page d'un compte bloqué (désactivé, hors plage — docs/DROITS-UTILISATEURS.md
 * § 9.1), câblée sur les téléviseurs (Apple TV, Android TV) : l'état de la porte
 * commune (api-client `useAccountAccess`), la décision de tv-core
 * (`decideAccountAccessScreen`), appliquées ici :
 *
 * - les écrans passent sans vue native (le rideau de la migration, `hideScreens`) ;
 * - la lecture est COUPÉE : l'écran de lecture au premier plan se ferme ;
 * - le focus entre sur l'action et reste dans le panneau ; Menu n'est jamais
 *   pris (tvOS : l'application quitte), Retour quitte sur Android TV ;
 * - l'action : « Changer de profil » (`switchProfile`, comme les réglages), ou
 *   « Se déconnecter du serveur » (le déjumelage commun, `settings`).
 *
 * La page se lève seule à la réouverture (la porte commune relit la route).
 */
export interface AccountAccessScreenState {
  blocked: AccountAccessBlocked | null;
  decision: AccountAccessScreenDecision;
}

export function useAccountAccessScreen(options: { enabled: boolean; playbackShown: boolean }): AccountAccessScreenState {
  const { storage } = useTentacleConfig();
  const blocked = useAccountAccess({ enabled: options.enabled });
  const profileSession = tvSessionMode(storage) === "profile";
  const record = profileSession ? readProfileRecord(storage) : null;
  const decision = decideAccountAccessScreen({
    blocked: blocked !== null,
    profileSession,
    soloProfile: record?.launch === "solo",
    pairedTheTv: record ? recordPairedTheTv(record) : true,
    playbackShown: options.playbackShown,
  });
  useEffect(() => {
    // La lecture coupée tout de suite : l'écran de lecture se ferme (son démontage poste l'arrêt).
    if (decision.stopPlayback && navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
  }, [decision.stopPlayback]);
  return { blocked, decision };
}

export function AccountAccessRedesign({ state }: { state: AccountAccessScreenState }) {
  return state.decision.show && state.blocked ? <AccessSurface blocked={state.blocked} actions={state.decision.actions} /> : null;
}

function AccessSurface({ blocked, actions }: { blocked: AccountAccessBlocked; actions: AccountAccessScreenAction[] }) {
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const unpairDevice = useUnpairDevice();
  const view = useMemo(() => accountAccessView(blocked, Date.now()), [blocked]);

  const store = useFocusStore();
  // Le piège naît avec le panneau : un groupe se lie dès son premier rendu.
  useState(() => store.bind(ACCOUNT_ACCESS_SCREEN.group, ACCOUNT_ACCESS_SCREEN_FOCUS.trapped ? { container: TrapFocusGuide } : null));
  useKeepFocusWithin(store, ACCOUNT_ACCESS_SCREEN_KEYS, accountAccessEntry(actions));
  useExitOnBack(true);

  const onAction = useCallback((action: AccountAccessScreenAction) => {
    // La page se lève : l'état bloqué n'appartient pas à la session qui vient.
    const leave = () => reportAccountAccess({ state: "allowed" });
    if (action === "switchProfile") {
      void switchProfile({ jfClient, storage, queryClient }).finally(leave);
      return;
    }
    unpairDevice("settings");
    leave();
  }, [jfClient, storage, queryClient, unpairDevice]);

  return (
    <View pointerEvents="box-none" style={styles.cover}>
      <FocusBindingProvider bind={store.binder}>
        <AccountAccessOverlay view={view} actions={actions} onAction={onAction} />
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  // Par-dessus TOUT ce que l'app monte à côté des écrans, voile hors ligne compris.
  cover: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
});
