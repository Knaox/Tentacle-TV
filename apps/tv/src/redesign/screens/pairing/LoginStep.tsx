import { memo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { loginKeyboardSubmits, loginSubmitPress } from "@tentacle-tv/tv-core";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text } from "../../theme/tokens";
import { useRemoteHints } from "../../remote/remoteHints";
import { PairingError } from "./PairingError";
import { PairingField, type PairingFieldHandle } from "./PairingField";
import type { LoginError } from "./pairingTypes";

/**
 * L'identifiant et le mot de passe, après le serveur saisi à la main : le
 * serveur visé (on sait à QUI on donne son mot de passe), les deux champs,
 * libellés au-dessus d'eux, l'erreur de la connexion sous eux, puis « Se
 * connecter » et le recours, « Jumeler avec un code » (le code du serveur).
 * La croix Retour, en haut à gauche, est posée par `PairingView`.
 *
 * Un clavier ne s'ouvre que sur un appui : OK sur un champ, ou « Se
 * connecter », qui ouvre le premier champ vide au lieu d'envoyer un
 * formulaire incomplet. Valider un clavier n'envoie que si les DEUX champs
 * sont remplis ; sinon il se referme, et BAS mène au champ suivant. Pas
 * d'enchaînement automatique : différé d'une seconde (le temps que le
 * premier clavier se retire), il rouvrait un clavier que l'utilisateur
 * venait d'ouvrir lui-même — « il repop » (essai réel).
 *
 * Branchement : `pairWithPassword` (tv-core) ; son verdict arrive dans
 * `error`. L'intégration vide le mot de passe dès l'envoi. Groupe de focus :
 * `pairing:actions` (les deux boutons, côte à côte sous les champs).
 */

export const LoginStep = memo(function LoginStep({
  serverUrl,
  username,
  password,
  signingIn,
  error,
  onChangeUsername,
  onChangePassword,
  onSubmit,
  onUseCode,
}: {
  serverUrl: string;
  username: string;
  password: string;
  signingIn: boolean;
  error: LoginError | null;
  onChangeUsername?: (username: string) => void;
  onChangePassword?: (password: string) => void;
  onSubmit?: () => void;
  onUseCode?: () => void;
}) {
  const { t } = useTranslation(["auth", "pairing"]);
  const hints = useRemoteHints();
  const usernameField = useRef<PairingFieldHandle>(null);
  const passwordField = useRef<PairingFieldHandle>(null);
  // « Se connecter » et la validation d'un clavier : la règle de tv-core (`session/loginForm`).
  const submit = () => {
    const press = loginSubmitPress({ username, password });
    if (press === "openUsername") usernameField.current?.open();
    else if (press === "openPassword") passwordField.current?.open();
    else onSubmit?.();
  };
  const submitIfComplete = () => {
    if (loginKeyboardSubmits({ username, password })) onSubmit?.();
  };

  return (
    <View style={styles.center}>
      <Text style={styles.title}>{t("auth:connectToAccount")}</Text>
      <Text style={styles.subtitle}>{t("pairing:tvLoginSubtitle")}</Text>
      <View style={styles.server}>
        <Icon name="server" size={26} color={colors.textTertiary} />
        <Text style={styles.serverLabel}>{t("pairing:tvServeur")}</Text>
        <Text style={styles.serverUrl} numberOfLines={1}>{serverUrl}</Text>
      </View>
      <View style={styles.fields}>
        <PairingField
          ref={usernameField}
          caption
          focusKey="pairing:username"
          icon="user"
          label={t("auth:username")}
          value={username}
          placeholder={t("pairing:tvUsernamePlaceholder")}
          keyboard={{ textContentType: "username", autoComplete: "username", returnKeyType: "done" }}
          onChangeText={onChangeUsername}
          onSubmitEditing={submitIfComplete}
        />
        <PairingField
          ref={passwordField}
          caption
          secure
          focusKey="pairing:password"
          icon="lock"
          label={t("auth:password")}
          value={password}
          placeholder={t("pairing:tvPasswordPlaceholder")}
          keyboard={{ textContentType: "password", autoComplete: "password", returnKeyType: "done" }}
          onChangeText={onChangePassword}
          onSubmitEditing={submitIfComplete}
        />
      </View>
      {error ? <PairingError message={loginMessage(t, error)} /> : null}
      <FocusGroup focusKey="pairing:actions" style={styles.actions}>
        <PillButton
          variant="primary"
          icon="login"
          label={signingIn ? t("auth:signingIn") : t("auth:signIn")}
          focusKey="pairing:signIn"
          onPress={signingIn ? undefined : submit}
        />
        <PillButton icon="phone" label={t("pairing:pairWithCode")} focusKey="pairing:useCode" onPress={signingIn ? undefined : onUseCode} />
      </FocusGroup>
      <View style={styles.hint}>
        <Icon name="remote" size={28} color={colors.textTertiary} />
        <Text style={styles.hintText}>{t(hints.loginTyping)}</Text>
      </View>
    </View>
  );
});

/** Chaque refus a sa phrase, qui dit quoi faire. */
function loginMessage(t: TFunction, error: LoginError): string {
  switch (error.key) {
    case "invalidCredentials":
      return t("pairing:tvLoginInvalid");
    case "accountRefused":
      return t("pairing:tvLoginRefused");
    case "tooManyAttempts":
      return t("pairing:tvLoginTooMany");
    case "tooManyPairings":
      return t("pairing:tvLoginTooManyPairings");
    case "jellyfinUnreachable":
      return t("pairing:tvLoginJellyfinDown");
    case "connectionTimeout":
      return t("auth:connectionTimeout");
    case "cannotReachServer":
      return t("auth:cannotReachServer");
    case "serverError":
      return error.status ? t("pairing:tvLoginServerError", { status: String(error.status) }) : t("pairing:tvLoginFailed");
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { ...text.title, fontSize: 64, lineHeight: 72, letterSpacing: -1.2, textAlign: "center" },
  subtitle: { ...fonts.regular, fontSize: 30, lineHeight: 40, color: colors.textSecondary, marginTop: 12, textAlign: "center" },
  server: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 22, maxWidth: 1100 },
  serverLabel: { ...fonts.bold, fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: colors.textTertiary },
  serverUrl: { ...fonts.semibold, fontSize: 26, color: colors.textSecondary, flexShrink: 1 },
  fields: { gap: 26, marginTop: 40 },
  actions: { flexDirection: "row", gap: 22, marginTop: 40 },
  hint: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 44 },
  hintText: { ...fonts.regular, fontSize: 24, lineHeight: 32, color: colors.textTertiary },
});
