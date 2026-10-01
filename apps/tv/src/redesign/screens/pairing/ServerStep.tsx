import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../brand/BrandMark";
import { PillButton } from "../../controls/PillButton";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text } from "../../theme/tokens";
import { PairingError } from "./PairingError";
import { PairingField } from "./PairingField";
import type { ServerError } from "./pairingTypes";

/**
 * Le serveur saisi à la main : un grand champ d'adresse (`PairingField`,
 * clavier système), l'exemple dessous, l'erreur de la vérification quand il y
 * en a une, « Vérifier le serveur » (la croix Retour, en haut à gauche, est
 * posée par `PairingView`).
 *
 * Branchement : `verifyServer(url)` ; son `errorKey` (espace `auth`) arrive
 * tel quel dans `error`, avec ses `errorParams` (le statut HTTP).
 */

export const ServerStep = memo(function ServerStep({ url, checking, error, onChangeUrl, onSubmit }: {
  url: string;
  checking: boolean;
  error: ServerError | null;
  onChangeUrl?: (url: string) => void;
  onSubmit?: () => void;
}) {
  const { t } = useTranslation(["auth", "pairing"]);
  return (
    <View style={styles.center}>
      <BrandMark size={96} />
      <Text style={styles.title}>{t("auth:serverAddress")}</Text>
      <Text style={styles.subtitle}>{t("auth:enterServerUrl")}</Text>
      <PairingField
        focusKey="pairing:url"
        icon="server"
        label={t("auth:serverAddress")}
        value={url}
        placeholder={t("auth:serverUrlPlaceholder")}
        busy={checking}
        keyboard={{ keyboardType: "url", returnKeyType: "done" }}
        onChangeText={onChangeUrl}
        onSubmitEditing={onSubmit}
      />
      <Text style={styles.example}>{t("auth:serverUrlHint")}</Text>
      {error ? <PairingError message={t(`auth:${error.key}`, error.params)} /> : null}
      <View style={styles.actions}>
        <PillButton
          variant="primary"
          icon="check"
          label={checking ? t("auth:connecting") : t("pairing:checkServer")}
          focusKey="pairing:check"
          onPress={checking ? undefined : onSubmit}
        />
      </View>
      <View style={styles.hint}>
        <Icon name="remote" size={28} color={colors.textTertiary} />
        <Text style={styles.hintText}>{t("pairing:tvRemoteHint")}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { ...text.title, fontSize: 64, lineHeight: 72, letterSpacing: -1.2, marginTop: 26, textAlign: "center" },
  subtitle: { ...fonts.regular, fontSize: 30, lineHeight: 40, color: colors.textSecondary, marginTop: 12, marginBottom: 48, textAlign: "center" },
  example: { ...fonts.regular, fontSize: 24, lineHeight: 32, color: colors.textTertiary, marginTop: 18 },
  actions: { flexDirection: "row", gap: 22, marginTop: 40 },
  hint: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 52 },
  hintText: { ...fonts.regular, fontSize: 24, lineHeight: 32, color: colors.textTertiary },
});
