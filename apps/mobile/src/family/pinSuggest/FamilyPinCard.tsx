import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { OwnPinSheet } from "@/components/family/PinSheet";
import {
  ctaGradient, FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, withAlpha, type AppTheme,
} from "@/theme";
import { useFamilyPinReminder } from "./useFamilyPinReminder";

/**
 * La carte « Action recommandée » en tête de l'écran Famille — tant que le
 * profil n'a pas de code PIN (règle partagée, `card`). Pas de « plus tard » :
 * elle s'en va d'elle-même dès que le code est posé (la Famille relue le dit).
 * Fond opaque teinté de la marque, aucun flou.
 */
export function FamilyPinCard() {
  const { t } = useTranslation("family");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { card } = useFamilyPinReminder();
  const [editing, setEditing] = useState(false);
  const gradient = ctaGradient(theme.colors.brand);
  if (!card && !editing) return null;

  return (
    <>
      {card ? (
        <View style={st.card}>
          <LinearGradient
            pointerEvents="none"
            colors={[
              withAlpha(theme.colors.brand.violet, 0.18, theme.colors.brand.glow),
              withAlpha(theme.colors.brand.accent, 0.08, "transparent"),
              "transparent",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={st.head}>
            <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.badge}>
              <Feather name="lock" size={19} color={theme.colors.cta.brandFg} />
            </LinearGradient>
            <View style={st.texts}>
              <Text style={st.eyebrow}>{t("pinSuggest.eyebrow").toUpperCase()}</Text>
              <Text style={st.title} accessibilityRole="header">{t("pinSuggest.title")}</Text>
            </View>
          </View>
          <Text style={st.body}>{t("pinSuggest.body")}</Text>
          <Pressable
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            style={({ pressed }) => [st.buttonWrap, pressed && st.dim]}
          >
            <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.button}>
              <Text style={st.buttonText}>{t("pinSuggest.set")}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}
      {editing ? <OwnPinSheet hasPin={false} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: RADIUS.xl,
      backgroundColor: t.colors.surface.s1,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.brand.violet, 0.35, t.colors.border.subtle),
      overflow: "hidden",
    },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    badge: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    texts: { flex: 1 },
    eyebrow: { ...typography.small, color: t.colors.brand.light, letterSpacing: 1.4 },
    title: { ...typography.subtitle, color: t.colors.text.primary, marginTop: 2 },
    body: { ...typography.body, color: t.colors.text.secondary, lineHeight: 21, marginTop: spacing.md },
    buttonWrap: { marginTop: spacing.md, borderRadius: RADIUS.lg, overflow: "hidden" },
    button: { minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
    buttonText: { ...typography.bodyBold, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.brandFg },
    dim: { opacity: 0.55 },
  });
