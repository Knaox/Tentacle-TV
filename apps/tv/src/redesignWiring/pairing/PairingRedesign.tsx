import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import { pairingBackAction, pairingEntryKey, type PairingBackAction } from "@tentacle-tv/tv-core";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { useFocusStore } from "../../platform/tvos/focus/focusStore";
import { openPairingKeyboard, useLoginErrorFocus, usePairingFocus, usePairingGroups } from "../../platform/tvos/screens/pairing";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { KeyboardOpenerProvider } from "../../redesign/screens/pairing/keyboardOpener";
import { PairingView } from "../../redesign/screens/pairing/PairingView";
import { usePairingFlow, type PairingFlow, type PairingFlowOptions } from "../../hooks/usePairingFlow";
import { useRelayPairingCode, useServerPairingCode } from "../../hooks/usePairingCode";
import { useVerifiedImage } from "../../hooks/useVerifiedImage";
import { useBackLayer } from "../back/BackScope";
import { toPairingStep } from "./pairingModel";

type Props = NativeStackScreenProps<RootStackParamList, "PairCode">;

/** Diamètre du portrait sur l'écran de succès. */
const PORTRAIT = 64;

/** Sur Apple TV, le serveur vérifié mène à l'identifiant et au mot de passe. */
const FLOW_OPTIONS: PairingFlowOptions = { afterServer: "login" };

/** La sortie d'une étape, que portent la croix Retour ET le bouton Menu (`pairingBackAction`, tv-core). */
function exitOf(flow: PairingFlow): (() => void) | null {
  const exits: Record<PairingBackAction, () => void> = {
    toWelcome: flow.backToWelcome,
    toServer: flow.backToServer,
    toLogin: flow.backToLogin,
  };
  const action = pairingBackAction(flow.step);
  return action ? exits[action] : null;
}

/**
 * Le jumelage de la refonte (Apple TV) : l'automate commun aux deux
 * téléviseurs (`usePairingFlow`, `usePairingCode`) rendu par `PairingView`.
 * Le serveur saisi à la main mène à l'identifiant et au mot de passe ; le code
 * du serveur reste leur recours (« Jumeler avec un code »).
 *
 * Le focus, que la vue ne décide pas : à chaque étape — et quand l'état du
 * code change (échec, expiration), ou qu'une connexion est refusée — il va à
 * l'action principale (`pairingEntryKey`, tv-core) ; la colonne et la carte de l'écran du
 * code sont des guides, pour que GAUCHE et DROITE passent de l'une à l'autre,
 * et les boutons des identifiants un guide où BAS entre par « Se connecter ».
 * La croix Retour n'a l'entrée que seule action — le code du relais affiché
 * — ; ailleurs, HAUT y mène et BAS en revient (`useBackFocus`, qui la
 * reverrouille à chaque étape). Pas de navigation latérale : il n'y a pas
 * encore de compte.
 *
 * Le bouton Menu recule d'une étape, comme la croix (la couche « page » du
 * Retour) ; sur l'accueil et le succès, il reste à UIKit, qui quitte
 * l'application — le jumelage n'est jamais une page poussée : tout chemin qui
 * y mène remet la pile à lui seul (`auth/unpair.ts`).
 *
 * Décidé par tv-core (`focus/pairingFocus.ts`, `session/loginForm.ts`,
 * `nav/screenBack.ts`), posé par l'applicateur `platform/tvos/screens/pairing.ts`
 * — qui fournit aussi aux champs le geste natif d'ouverture du clavier.
 */
export function PairingRedesign({ navigation }: Props) {
  const onPaired = useCallback(() => navigation.replace("Home"), [navigation]);
  const flow = usePairingFlow(onPaired, FLOW_OPTIONS);
  const relay = useRelayPairingCode(flow.step === "relayCode", flow.onRelayConfirmed);
  const server = useServerPairingCode(flow.step === "manualCode", flow.onServerConfirmed);
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();

  // Le serveur retenu par la vérification (les identifiants et l'écran du code l'affichent).
  const serverUrl = flow.step === "manualCode" || flow.step === "manualLogin"
    ? storage.getItem("tentacle_server_url") ?? flow.serverUrl
    : "";
  // Le portrait du compte accueilli, s'il en a un (sinon, son nom seul).
  const accountId = flow.account?.id;
  const portrait = useVerifiedImage(
    accountId ? `${client.getBaseUrl()}/Users/${accountId}/Images/Primary?maxWidth=${PORTRAIT * 2}&quality=90` : null,
  );

  const step = toPairingStep(flow, relay, server, serverUrl, portrait);

  const store = useFocusStore();
  usePairingGroups(store);
  usePairingFocus(store, { entryKey: pairingEntryKey(step), arrival: step.kind });
  useLoginErrorFocus(store, step.kind === "manualLogin" ? step.error : null);

  // Réessayer comme Générer un nouveau code : le code de l'étape affichée.
  const retryCode = flow.step === "manualCode" ? server.regenerate : relay.regenerate;
  const exit = exitOf(flow);
  useBackLayer("page", exit !== null, () => exit?.());

  return (
    <View style={styles.fill}>
      <FocusBindingProvider bind={store.binder}>
        <KeyboardOpenerProvider value={openPairingKeyboard}>
        <PairingView
          step={step}
          language={flow.language}
          onChangeLanguage={flow.changeLanguage}
          onShowCode={flow.showRelayCode}
          onManualSetup={flow.manualSetup}
          onRetryCode={retryCode}
          onCancel={flow.backToWelcome}
          onChangeServer={flow.changeServer}
          onChangeUrl={flow.changeUrl}
          onSubmitUrl={flow.submitServer}
          onBack={flow.backToWelcome}
          onChangeUsername={flow.login.changeUsername}
          onChangePassword={flow.login.changePassword}
          onSubmitLogin={flow.login.submit}
          onUseCode={flow.showServerCode}
          onLoginBack={flow.backToServer}
          onServerCodeBack={flow.backToLogin}
        />
        </KeyboardOpenerProvider>
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
