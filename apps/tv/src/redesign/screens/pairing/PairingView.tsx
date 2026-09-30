import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { CodeStep } from "./CodeStep";
import type { PairingViewProps } from "./pairingTypes";
import { ServerStep } from "./ServerStep";
import { SuccessStep } from "./SuccessStep";
import { WelcomeStep } from "./WelcomeStep";

export type { CodeState, PairingLanguage, PairingStep, PairingViewProps, ServerError, ServerErrorKey } from "./pairingTypes";

/**
 * Le jumelage (`PairCode`) : l'automate en cinq étapes, toutes gardées —
 * accueil (avec la LANGUE, reprise de l'écran des conditions supprimé), code
 * du relais, serveur saisi à la main, code du serveur, succès. Pas de
 * navigation latérale : il n'y a pas encore de compte.
 *
 * Contrat : l'intégration tient l'étape (`step`) et ses états, et reçoit les
 * gestes. Accueil → `onShowCode` / `onManualSetup` / `onChangeLanguage`
 * (`i18n.changeLanguage` + `tentacle_language`) ; code du relais →
 * `useRelayGenerate` + `useRelayStatus`, `onRetryCode`, `onCancel` ; serveur →
 * `verifyServer` (`checking`, `error.key` = `errorKey`), `onChangeUrl`,
 * `onSubmitUrl`, `onBack` ; code du serveur → `useDevicePairGenerate` +
 * `useDevicePairStatus`, `onChangeServer` ; succès → nom (et portrait) du
 * compte, puis `navigation.replace("Home")`.
 */

/** Une lumière chaude, sans violet : l'ambre de l'accent et un bleu-vert
 *  profond. Aucune œuvre n'éclaire encore l'écran. */
const PAIRING_PALETTE: ArtworkPalette = {
  glows: ["#8a5526", "#1d5566", "#7a4424"],
  deep: "#0b0a0c",
};

export const PairingView = memo(function PairingView({
  step,
  language,
  palette = PAIRING_PALETTE,
  onChangeLanguage,
  onShowCode,
  onManualSetup,
  onRetryCode,
  onCancel,
  onChangeServer,
  onChangeUrl,
  onSubmitUrl,
  onBack,
}: PairingViewProps) {
  // Abonné à la langue : l'écran se retraduit dès qu'on la change ici.
  useTranslation();
  const codeStep = step.kind === "relayCode" || step.kind === "serverCode";
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} intensity={1.15} />
      <Animated.View key={step.kind} entering={FadeIn.duration(320)} style={styles.fill}>
        {step.kind === "welcome" ? (
          <WelcomeStep
            language={language}
            glowColor={palette.glows[0]}
            onShowCode={onShowCode}
            onManualSetup={onManualSetup}
            onChangeLanguage={onChangeLanguage}
          />
        ) : null}
        {step.kind === "relayCode" ? (
          <CodeStep source="relay" code={step.code} palette={palette} onRetry={onRetryCode} onCancel={onCancel} onManualSetup={onManualSetup} />
        ) : null}
        {step.kind === "serverCode" ? (
          <CodeStep source="server" code={step.code} serverUrl={step.serverUrl} palette={palette} onRetry={onRetryCode} onChangeServer={onChangeServer} />
        ) : null}
        {step.kind === "manualServer" ? (
          <ServerStep url={step.url} checking={step.checking} error={step.error} onChangeUrl={onChangeUrl} onSubmit={onSubmitUrl} onBack={onBack} />
        ) : null}
        {step.kind === "success" ? <SuccessStep userName={step.userName} avatarUri={step.avatarUri} /> : null}
      </Animated.View>
      {codeStep ? (
        <View style={styles.brand} pointerEvents="none">
          <BrandMark size={52} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
