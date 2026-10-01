import { memo, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { BrandMark } from "../../brand/BrandMark";
import { PillButton } from "../../controls/PillButton";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, text } from "../../theme/tokens";
import type { ServerError } from "./pairingTypes";

/**
 * Le serveur saisi à la main : un grand champ d'adresse, l'exemple dessous,
 * l'erreur de la vérification quand il y en a une, « Vérifier le serveur »
 * (la croix Retour, en haut à gauche, est posée par `PairingView`). OK sur le
 * champ ouvre le clavier système : la saisie passe
 * par un `TextInput` INVISIBLE (le champ natif de tvOS dessinerait sa propre
 * pastille grise dans la nôtre), le champ affiché n'est qu'un texte. Ce
 * geste ne décide d'aucun focus — à vérifier sur l'appareil : le clavier
 * doit s'ouvrir sur un champ transparent.
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
  const input = useRef<TextInput>(null);
  return (
    <View style={styles.center}>
      <BrandMark size={96} />
      <Text style={styles.title}>{t("auth:serverAddress")}</Text>
      <Text style={styles.subtitle}>{t("auth:enterServerUrl")}</Text>
      <FocusTarget focusKey="pairing:url" form="row" onPress={() => input.current?.focus()} accessibilityLabel={t("auth:serverAddress")}>
        {(focused) => <Field focused={focused} url={url} checking={checking} placeholder={t("auth:serverUrlPlaceholder")} />}
      </FocusTarget>
      <TextInput
        ref={input}
        value={url}
        onChangeText={onChangeUrl}
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="done"
        style={styles.hiddenInput}
      />
      <Text style={styles.example}>{t("auth:serverUrlHint")}</Text>
      {error ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.error}>
          <Icon name="alert" size={30} color={colors.errorFg} strokeWidth={2.4} />
          <Text style={styles.errorText}>{t(`auth:${error.key}`, error.params)}</Text>
        </Animated.View>
      ) : null}
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

const FIELD = { width: 1100, height: 108, radius: 34 };

function Field({ focused, url, checking, placeholder }: { focused: boolean; url: string; checking: boolean; placeholder: string }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.025 * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const offLayer = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const ink = focused ? colors.ctaFg : colors.text;
  const empty = url.length === 0;
  return (
    <Animated.View style={[styles.field, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fieldShadow, onLayer]} />
      <Animated.View style={[StyleSheet.absoluteFill, offLayer]}>
        <GlassSurface radius={FIELD.radius} tone="clear" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fieldWhite, onLayer]} />
      <View style={styles.fieldRow}>
        <Icon name="server" size={32} color={focused ? colors.ctaFg : colors.textSecondary} strokeWidth={2.2} />
        <Text
          style={[styles.value, { color: empty ? (focused ? scrim(0.4) : colors.textQuaternary) : ink }]}
          numberOfLines={1}
        >
          {empty ? placeholder : url}
        </Text>
        {checking ? <ActivityIndicator size="large" color={ink} /> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { ...text.title, fontSize: 64, lineHeight: 72, letterSpacing: -1.2, marginTop: 26, textAlign: "center" },
  subtitle: { ...fonts.regular, fontSize: 30, lineHeight: 40, color: colors.textSecondary, marginTop: 12, marginBottom: 48, textAlign: "center" },
  field: { width: FIELD.width, height: FIELD.height, borderRadius: FIELD.radius },
  fieldShadow: {
    borderRadius: FIELD.radius,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
  },
  fieldWhite: { borderRadius: FIELD.radius, backgroundColor: colors.ctaBg },
  fieldRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 36 },
  value: { ...fonts.semibold, flex: 1, fontSize: 36, lineHeight: 44 },
  hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0 },
  example: { ...fonts.regular, fontSize: 24, lineHeight: 32, color: colors.textTertiary, marginTop: 18 },
  error: {
    width: FIELD.width,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 28,
    paddingVertical: 22,
    paddingHorizontal: 30,
    borderRadius: 26,
    backgroundColor: "rgba(239, 68, 68, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.42)",
  },
  errorText: { ...fonts.medium, flex: 1, fontSize: 26, lineHeight: 36, color: colors.text },
  actions: { flexDirection: "row", gap: 22, marginTop: 40 },
  hint: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 52 },
  hintText: { ...fonts.regular, fontSize: 24, lineHeight: 32, color: colors.textTertiary },
});
