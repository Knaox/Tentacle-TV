import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { BACK_BUTTON_SIZE, BACK_TOP, BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { CodeStep } from "./CodeStep";
import { LoginStep } from "./LoginStep";
import type { PairingViewProps } from "./pairingTypes";
import { ServerStep } from "./ServerStep";
import { SuccessStep } from "./SuccessStep";
import { WelcomeStep } from "./WelcomeStep";

export type { CodeState, LoginError, PairingLanguage, PairingStep, PairingViewProps, ServerError, ServerErrorKey } from "./pairingTypes";

/**
 * Le jumelage (`PairCode`) : l'automate en six étapes, toutes gardées —
 * accueil (avec la LANGUE, reprise de l'écran des conditions supprimé), code
 * du relais, serveur saisi à la main, identifiant et mot de passe, code du
 * serveur, succès. Pas de navigation latérale : il n'y a pas encore de compte.
 *
 * Contrat : l'intégration tient l'étape (`step`) et ses états, et reçoit les
 * gestes. Accueil → `onShowCode` / `onManualSetup` / `onChangeLanguage`
 * (`i18n.changeLanguage` + `tentacle_language`) ; code du relais →
 * `useRelayGenerate` + `useRelayStatus`, `onRetryCode`, `onCancel` ; serveur →
 * `verifyServer` (`checking`, `error.key` = `errorKey`), `onChangeUrl`,
 * `onSubmitUrl`, `onBack` ; identifiants → `pairWithPassword` (tv-core),
 * `onChangeUsername`, `onChangePassword`, `onSubmitLogin`, `onUseCode`,
 * `onLoginBack` ; code du serveur → `useDevicePairGenerate` +
 * `useDevicePairStatus`, `onChangeServer`, `onServerCodeBack` ; succès → nom
 * (et portrait) du compte, puis `navigation.replace("Home")`.
 *
 * La sortie d'une étape — code du relais et serveur manuel vers l'accueil,
 * identifiants vers le serveur, code du serveur vers les identifiants (avec
 * `onServerCodeBack`) — est la croix Retour, en haut à gauche de l'écran
 * comme partout (`BackButton`) ; le code du serveur garde aussi « Changer de
 * serveur ».
 *
 * Clés de focus : accueil `pairing:showCode`, `pairing:manual`,
 * `pairing:lang:<fr|en>` ; la croix `pairing:back` (relais, serveur
 * manuel, identifiants, code du serveur) ; code `pairing:changeServer`
 * (serveur), `pairing:retry`, `pairing:manual`, `pairing:regenerate` ;
 * serveur `pairing:url`, `pairing:check` ; identifiants `pairing:username`,
 * `pairing:password`, `pairing:signIn`, `pairing:useCode`. Groupes :
 * `pairing:top` (la bande de la croix, pleine largeur), `pairing:side` (code
 * du serveur), `pairing:card` (`CodeStep`) et `pairing:actions` (les boutons
 * des identifiants).
 */

/** Une lumière froide et neutre, ni ambre ni violet : un gris bleuté et un
 *  bleu-vert profond. Aucune œuvre n'éclaire encore l'écran ; la marque est
 *  dans la mascotte, sa lumière et le halo du code — jamais dans le fond. */
const PAIRING_PALETTE: ArtworkPalette = {
  glows: ["#3a3f5c", "#1d5566", "#34384f"],
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
  onChangeUsername,
  onChangePassword,
  onSubmitLogin,
  onUseCode,
  onLoginBack,
  onServerCodeBack,
}: PairingViewProps) {
  // Abonné à la langue : l'écran se retraduit dès qu'on la change ici.
  useTranslation();
  // La mascotte en petit, dans le coin, là où l'étape n'en porte pas en grand.
  const cornerBrand = step.kind === "relayCode" || step.kind === "serverCode" || step.kind === "manualLogin";
  const back = backOf(step.kind, { onCancel, onBack, onLoginBack, onServerCodeBack });
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} intensity={1.15} />
      <Animated.View key={step.kind} entering={FadeIn.duration(320)} style={styles.fill}>
        {step.kind === "welcome" ? (
          <WelcomeStep
            language={language}
            onShowCode={onShowCode}
            onManualSetup={onManualSetup}
            onChangeLanguage={onChangeLanguage}
          />
        ) : null}
        {step.kind === "relayCode" ? (
          <CodeStep source="relay" code={step.code} palette={palette} onRetry={onRetryCode} onManualSetup={onManualSetup} />
        ) : null}
        {step.kind === "serverCode" ? (
          <CodeStep source="server" code={step.code} serverUrl={step.serverUrl} palette={palette} onRetry={onRetryCode} onChangeServer={onChangeServer} />
        ) : null}
        {step.kind === "manualServer" ? (
          <ServerStep url={step.url} checking={step.checking} error={step.error} onChangeUrl={onChangeUrl} onSubmit={onSubmitUrl} />
        ) : null}
        {step.kind === "manualLogin" ? (
          <LoginStep
            serverUrl={step.serverUrl}
            username={step.username}
            password={step.password}
            signingIn={step.signingIn}
            error={step.error}
            onChangeUsername={onChangeUsername}
            onChangePassword={onChangePassword}
            onSubmit={onSubmitLogin}
            onUseCode={onUseCode}
          />
        ) : null}
        {step.kind === "success" ? <SuccessStep userName={step.userName} avatarUri={step.avatarUri} /> : null}
        {back !== null ? (
          <FocusGroup focusKey="pairing:top" style={styles.backBar}>
            <BackButton focusKey="pairing:back" onPress={back} />
          </FocusGroup>
        ) : null}
      </Animated.View>
      {cornerBrand ? (
        <View style={styles.brand} pointerEvents="none">
          <BrandMark size={52} />
        </View>
      ) : null}
    </View>
  );
});

/**
 * La sortie de l'étape, que la croix porte : `null` sans croix (accueil,
 * succès, code du serveur sans `onServerCodeBack`). Au banc, sans gestes, une
 * étape qui a sa croix la montre quand même (`undefined`).
 */
function backOf(
  kind: PairingViewProps["step"]["kind"],
  handlers: Pick<PairingViewProps, "onCancel" | "onBack" | "onLoginBack" | "onServerCodeBack">,
): (() => void) | undefined | null {
  switch (kind) {
    case "relayCode":
      return handlers.onCancel;
    case "manualServer":
      return handlers.onBack;
    case "manualLogin":
      return handlers.onLoginBack;
    case "serverCode":
      return handlers.onServerCodeBack ?? null;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
  // En haut à gauche, sur toute la largeur : HAUT depuis le champ ou la carte y monte.
  backBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BACK_TOP + BACK_BUTTON_SIZE,
    paddingTop: BACK_TOP,
    paddingLeft: TV_STAGE.safe.x,
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
