import { useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { i18n } from "@tentacle-tv/shared";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { TentacleLogo } from "@/components/TentacleLogo";
import { SubtleBackground, GlassCard, FadeIn } from "@/components/ui";
import {
  FONT_FAMILY,
  RADIUS,
  CONTENT_MAX_WIDTH,
  useTheme,
  useThemedStyles,
  withAlpha,
  type AppTheme,
} from "@/theme";

const LANGS = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
] as const;

export default function DisclaimerScreen() {
  const { t } = useTranslation("disclaimer");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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

  const handleAccept = useCallback(() => {
    if (!checked) return;
    storage.setItem("disclaimer_accepted", "true");
    router.replace("/(auth)/server-setup");
  }, [checked, storage, router]);

  const handleDecline = useCallback(() => {
    Alert.alert(t("declineTitle"), t("declineMessage"));
  }, [t]);

  return (
    <SubtleBackground ambient>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 24) + 20, paddingBottom: insets.bottom + 16 }]}>
        <FadeIn delay={0} translateY={10}>
          <View style={styles.langRow} accessibilityRole="radiogroup">
            {LANGS.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => switchLang(l.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: lang === l.code }}
                accessibilityLabel={l.label}
                style={({ pressed }) => [
                  styles.langButton,
                  lang === l.code && styles.langButtonActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>

        <FadeIn delay={60} translateY={10} style={styles.logoContainer}>
          <TentacleLogo size={56} />
          <Text style={styles.appName}>Tentacle TV</Text>
        </FadeIn>

        <FadeIn delay={120} translateY={10}>
          <Text style={styles.title} accessibilityRole="header">{t("title")}</Text>
          <Text style={styles.heading}>{t("heading")}</Text>
        </FadeIn>

        <FadeIn delay={180} translateY={12} style={{ flex: 1 }}>
          <GlassCard style={styles.glassContainer} noPadding>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ padding: 20 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.body}>{t("body")}</Text>
            </ScrollView>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={240} translateY={10}>
          <Pressable
            onPress={() => setChecked((v) => !v)}
            style={({ pressed }) => [
              styles.checkboxRow,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={t("checkboxLabel")}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <Feather name="check" size={16} color={colors.cta.brandFg} />}
            </View>
            <Text style={styles.checkboxLabel}>{t("checkboxLabel")}</Text>
          </Pressable>
        </FadeIn>

        <FadeIn delay={300} translateY={10}>
          <Pressable
            onPress={handleAccept}
            disabled={!checked}
            accessibilityRole="button"
            accessibilityLabel={t("accept")}
            style={({ pressed }) => [
              styles.acceptButton,
              !checked && styles.acceptButtonDisabled,
              checked && pressed && { opacity: 0.88 },
            ]}
          >
            <Text style={styles.acceptText}>{t("accept")}</Text>
          </Pressable>

          <Pressable
            onPress={handleDecline}
            style={({ pressed }) => [
              styles.declineButton,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("decline")}
          >
            <Text style={styles.declineText}>{t("decline")}</Text>
          </Pressable>
        </FadeIn>
      </View>
    </SubtleBackground>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  root: {
    flex: 1,
    // Colonne centrée bornée sur grand écran (iPad / tablette) — full width sur téléphone.
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  appName: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.bold,
    color: t.colors.brand.light,
    letterSpacing: 1.4,
    marginTop: 8,
    textTransform: "uppercase",
  },
  langRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 4,
  },
  langButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "transparent",
    justifyContent: "center",
  },
  langButtonActive: {
    backgroundColor: t.colors.brand.soft,
    borderColor: withAlpha(t.colors.brand.violet, 0.4, t.colors.brand.glow),
  },
  langText: {
    fontSize: 12,
    fontFamily: FONT_FAMILY.bold,
    letterSpacing: 0.5,
    color: t.colors.text.quaternary,
  },
  langTextActive: {
    color: t.colors.brand.light,
  },
  title: {
    fontSize: 28,
    fontFamily: FONT_FAMILY.extrabold,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: t.colors.text.primary,
    textAlign: "center",
  },
  heading: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.medium,
    color: t.colors.brand.light,
    letterSpacing: 0.3,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  glassContainer: {
    flex: 1,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  body: {
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
    color: t.colors.text.secondary,
    lineHeight: 22,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    minHeight: 44,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.text.quaternary,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: t.colors.brand.violet,
    borderColor: t.colors.brand.violet,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT_FAMILY.regular,
    color: t.colors.text.secondary,
    lineHeight: 20,
  },
  acceptButton: {
    backgroundColor: t.colors.cta.primaryBg,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    // Glow de marque sous le CTA (violet), thémé — pas une ombre noire neutre.
    shadowColor: t.colors.brand.violet,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 12,
  },
  acceptButtonDisabled: {
    opacity: 0.4,
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptText: {
    color: t.colors.cta.primaryFg,
    fontSize: 15,
    fontFamily: FONT_FAMILY.bold,
    letterSpacing: 0.2,
  },
  declineButton: {
    borderRadius: RADIUS.md,
    minHeight: 44,
    paddingVertical: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.colors.border.subtle,
  },
  declineText: {
    fontSize: 13,
    fontFamily: FONT_FAMILY.medium,
    color: t.colors.brand.light,
    letterSpacing: 0.3,
  },
});
