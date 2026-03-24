import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { i18n } from "@tentacle-tv/shared";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { TentacleLogo } from "@/components/TentacleLogo";
import { colors, spacing, typography } from "@/theme";

const LANGS = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
] as const;

export default function DisclaimerScreen() {
  const { t } = useTranslation("disclaimer");
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  // Fade-in animation
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const handleAccept = useCallback(() => {
    storage.setItem("disclaimer_accepted", "true");
    router.replace("/(auth)/server-setup");
  }, [storage, router]);

  const handleDecline = useCallback(() => {
    Alert.alert(t("declineTitle"), t("declineMessage"));
  }, [t]);

  return (
    <Animated.View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }, fadeStyle]}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <TentacleLogo size={56} />
        <Text style={styles.appName}>Tentacle TV</Text>
      </View>

      {/* Language switcher */}
      <View style={styles.langRow}>
        {LANGS.map((l) => (
          <Pressable key={l.code} onPress={() => switchLang(l.code)} style={[styles.langButton, lang === l.code && styles.langButtonActive]}>
            <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>{l.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Title */}
      <Text style={styles.title}>{t("title")}</Text>
      <Text style={styles.heading}>{t("heading")}</Text>

      {/* Body — scrollable glass container */}
      <View style={styles.glassContainer}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.body}>{t("body")}</Text>
        </ScrollView>
      </View>

      {/* Checkbox */}
      <Pressable onPress={() => setChecked((v) => !v)} style={styles.checkboxRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Text style={styles.checkmark}>{"\u2713"}</Text>}
        </View>
        <Text style={styles.checkboxLabel}>{t("checkboxLabel")}</Text>
      </Pressable>

      {/* Buttons */}
      <Pressable
        onPress={handleAccept}
        disabled={!checked}
        style={[styles.acceptButton, !checked && styles.acceptButtonDisabled]}
        accessibilityRole="button"
      >
        <Text style={styles.acceptText}>{t("accept")}</Text>
      </Pressable>

      <Pressable onPress={handleDecline} style={styles.declineButton} accessibilityRole="button">
        <Text style={styles.declineText}>{t("decline")}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screenPadding,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  appName: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 8,
  },
  langRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  langButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  langButtonActive: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  langText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.3)",
  },
  langTextActive: {
    color: colors.accent,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: "center",
  },
  heading: {
    ...typography.body,
    color: colors.accent,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  glassContainer: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    backgroundColor: "rgba(255, 255, 255, 0.035)",
    padding: spacing.md,
    marginBottom: 20,
  },
  scroll: {
    flex: 1,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  acceptButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  acceptButtonDisabled: {
    opacity: 0.4,
  },
  acceptText: {
    ...typography.bodyBold,
    color: "#fff",
  },
  declineButton: {
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  declineText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
