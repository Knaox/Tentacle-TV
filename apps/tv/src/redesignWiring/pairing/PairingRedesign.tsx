import { useCallback, useEffect, useState } from "react";
import { useJellyfinClient, useTentacleConfig } from "@tentacle-tv/api-client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { PairingView } from "../../redesign/screens/pairing/PairingView";
import { usePairingFlow, type PairingFlowOptions } from "../../hooks/usePairingFlow";
import { useRelayPairingCode, useServerPairingCode } from "../../hooks/usePairingCode";
import { useVerifiedImage } from "../../hooks/useVerifiedImage";
import { useBackFocus } from "../focus/backFocus";
import { useFocusStore } from "../focus/focusStore";
import { AutoFocusGuide } from "../focus/focusGuides";
import { useLoginErrorFocus } from "./loginFocus";
import { PAIRING_BACK_KEY, entryKeyOf, toPairingStep } from "./pairingModel";

type Props = NativeStackScreenProps<RootStackParamList, "PairCode">;

/** Diamètre du portrait sur l'écran de succès. */
const PORTRAIT = 64;

/** Sur Apple TV, le serveur vérifié mène à l'identifiant et au mot de passe. */
const FLOW_OPTIONS: PairingFlowOptions = { afterServer: "login" };

/**
 * Le jumelage de la refonte (Apple TV) : l'automate commun aux deux
 * téléviseurs (`usePairingFlow`, `usePairingCode`) rendu par `PairingView`.
 * Le serveur saisi à la main mène à l'identifiant et au mot de passe ; le code
 * du serveur reste leur recours (« Jumeler avec un code »).
 *
 * Le focus, que la vue ne décide pas : à chaque étape — et quand l'état du
 * code change (échec, expiration), ou qu'une connexion est refusée — il va à
 * l'action principale (`entryKeyOf`) ; la colonne et la carte de l'écran du
 * code sont des guides, pour que GAUCHE et DROITE passent de l'une à l'autre,
 * et les boutons des identifiants un guide où BAS entre par « Se connecter ».
 * La croix Retour n'a l'entrée que seule action — le code du relais affiché
 * — ; ailleurs, HAUT y mène et BAS en revient (`useBackFocus`, qui la
 * reverrouille à chaque étape). Pas de navigation latérale : il n'y a pas
 * encore de compte.
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
  // Les guides naissent avec l'écran, avant son premier rendu : un groupe se
  // lie dès qu'il paraît, jamais en cours de route.
  useState(() => {
    store.bind("pairing:side", { container: AutoFocusGuide });
    store.bind("pairing:card", { container: AutoFocusGuide });
    // BAS depuis le mot de passe : « Se connecter » d'abord. Laissé à la
    // géométrie, tvOS prenait le bouton le plus proche du centre du champ —
    // le recours (un `nextFocusDown` posé sur le champ n'y fait rien, mesuré).
    store.bind("pairing:actions", { container: AutoFocusGuide });
  });
  const entryKey = entryKeyOf(step);
  useBackFocus(store, { backKey: PAIRING_BACK_KEY, barKey: "pairing:top", entryKey, arrival: step.kind });
  useEffect(() => (entryKey ? store.claim(entryKey) : undefined), [entryKey, store]);
  useLoginErrorFocus(store, step.kind === "manualLogin" ? step.error : null);

  // Réessayer comme Générer un nouveau code : le code de l'étape affichée.
  const retryCode = flow.step === "manualCode" ? server.regenerate : relay.regenerate;

  return (
    <FocusBindingProvider bind={store.binder}>
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
    </FocusBindingProvider>
  );
}
