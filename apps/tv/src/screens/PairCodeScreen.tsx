import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { WelcomeStep } from "../components/pairing/WelcomeStep";
import { RelayCodeDisplay } from "../components/pairing/RelayCodeDisplay";
import { ServerInputStep } from "../components/pairing/ServerInputStep";
import { ServerCodeDisplayStep } from "../components/pairing/ServerCodeDisplayStep";
import { PairingSuccessStep } from "../components/pairing/PairingSuccessStep";
import { usePairingFlow } from "../hooks/usePairingFlow";

type Props = NativeStackScreenProps<RootStackParamList, "PairCode">;

/**
 * Le jumelage : l'automate vit dans `usePairingFlow` (et le code dans
 * `usePairingCode`), cet écran n'en fait que le rendu.
 */
export function PairCodeScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation(["auth", "pairing"]);
  const onPaired = useCallback(() => navigation.replace("Home"), [navigation]);
  const flow = usePairingFlow(onPaired);

  switch (flow.step) {
    case "welcome":
      return (
        <WelcomeStep
          onShowCode={flow.showRelayCode}
          onManualSetup={flow.manualSetup}
          onSwitchLang={flow.changeLanguage}
          currentLang={i18n.language}
        />
      );

    case "relayCode":
      return (
        <RelayCodeDisplay
          onConfirmed={flow.onRelayConfirmed}
          onCancel={flow.backToWelcome}
          onManualSetup={flow.manualSetup}
        />
      );

    case "manualServer":
      return (
        <ServerInputStep
          serverUrl={flow.serverUrl}
          onChangeUrl={flow.changeUrl}
          testing={flow.testing}
          error={flow.serverError ? t(`auth:${flow.serverError.key}`, flow.serverError.params) : null}
          onSubmit={flow.submitServer}
          onBack={flow.backToWelcome}
          onSwitchLang={flow.changeLanguage}
          currentLang={i18n.language}
        />
      );

    case "manualCode":
      return (
        <ServerCodeDisplayStep
          onConfirmed={flow.onServerConfirmed}
          onChangeServer={flow.changeServer}
        />
      );

    case "success":
      return <PairingSuccessStep username={flow.account?.name ?? ""} />;
  }
}
