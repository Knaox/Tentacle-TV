import { useState, useCallback } from "react";
import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { i18n } from "@tentacle-tv/shared";
import { Colors, Spacing, Typography } from "../theme/colors";
import { Focusable } from "../components/focus/Focusable";
import { TentacleLogo } from "../components/icons/TentacleLogo";

const LANGS = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
] as const;

export function DisclaimerScreen() {
  const { t } = useTranslation("disclaimer");
  const navigation = useNavigation();
  const { storage } = useTentacleConfig();
  const [checked, setChecked] = useState(false);
  const [lang, setLang] = useState(() => {
    const saved = storage.getItem("tentacle_language");
    return saved?.startsWith("fr") ? "fr" : "en";
  });

  const switchLang = useCallback((code: string) => {
    i18n.changeLanguage(code);
    storage.setItem("tentacle_language", code);
    setLang(code);
  }, [storage]);

  const handleAccept = useCallback(() => {
    storage.setItem("disclaimer_accepted", "true");
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "PairCode" as never }] }),
    );
  }, [storage, navigation]);

  const handleDecline = useCallback(() => {
    Alert.alert(t("declineTitle"), t("declineMessage"));
  }, [t]);

  return (
    <View style={styles.root}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <TentacleLogo size={64} />
        <Text style={styles.appName}>Tentacle TV</Text>
      </View>

      {/* Language switcher */}
      <View style={styles.langRow}>
        {LANGS.map((l) => (
          <Focusable key={l.code} variant="button" onPress={() => switchLang(l.code)}>
            <View style={[styles.langButton, lang === l.code && styles.langButtonActive]}>
              <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>{l.label}</Text>
            </View>
          </Focusable>
        ))}
      </View>

      {/* Title */}
      <Text style={styles.title}>{t("title")}</Text>
      <Text style={styles.heading}>{t("heading")}</Text>

      {/* Glass body */}
      <View style={styles.glassContainer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.body}>{t("body")}</Text>
        </ScrollView>
      </View>

      {/* Checkbox */}
      <Focusable
        variant="button"
        onPress={() => setChecked((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View style={styles.checkboxRow}>
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && <Text style={styles.checkmark}>{"\u2713"}</Text>}
          </View>
          <Text style={styles.checkboxLabel}>{t("checkboxLabel")}</Text>
        </View>
      </Focusable>

      {/* Buttons */}
      <View style={styles.buttonsRow}>
        <Focusable
          variant="button"
          onPress={handleAccept}
          disabled={!checked}
          hasTVPreferredFocus={false}
        >
          <View style={[styles.acceptButton, !checked && styles.acceptButtonDisabled]}>
            <Text style={styles.acceptText}>{t("accept")}</Text>
          </View>
        </Focusable>

        <Focusable variant="button" onPress={handleDecline}>
          <View style={styles.declineButton}>
            <Text style={styles.declineText}>{t("decline")}</Text>
          </View>
        </Focusable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
    paddingHorizontal: 80,
    paddingVertical: 48,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginTop: 8,
  },
  langRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 16,
  },
  langButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  langButtonActive: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  langText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textMuted,
  },
  langTextActive: {
    color: Colors.accentPurple,
  },
  title: {
    ...Typography.heading,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  heading: {
    fontSize: 18,
    color: Colors.accentPurple,
    textAlign: "center",
    marginBottom: 20,
  },
  glassContainer: {
    maxHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    padding: Spacing.lg,
    marginBottom: 24,
  },
  body: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 26,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: Colors.accentPurple,
    borderColor: Colors.accentPurple,
  },
  checkmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
    flex: 1,
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 20,
  },
  acceptButton: {
    backgroundColor: Colors.accentPurple,
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 16,
  },
  acceptButtonDisabled: {
    opacity: 0.4,
  },
  acceptText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  declineButton: {
    borderRadius: 12,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  declineText: {
    color: Colors.textMuted,
    fontSize: 16,
    textAlign: "center",
  },
});
