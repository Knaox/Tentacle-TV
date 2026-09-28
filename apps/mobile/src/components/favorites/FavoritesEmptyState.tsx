import { memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, typography, FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

const STEPS = [
  { icon: "heart", key: "emptyStepLike" },
  { icon: "layers", key: "emptyStepGroup" },
  { icon: "rotate-ccw", key: "emptyStepResume" },
] as const;

/**
 * Mes favoris vide — la liste n'a encore jamais rien reçu. Emblème cœur 72
 * dans une lueur de marque (statique), titre, trois étapes, puis deux sorties :
 * les bibliothèques (pilule pleine) et « Pour vous » (pilule fantôme). La
 * troisième étape parle de reprise et non de partage : le lien des titres
 * likés n'existe que sur le bureau. Une liste FILTRÉE à zéro n'arrive jamais
 * ici. Même dessin que le miroir web.
 */
export const FavoritesEmptyState = memo(function FavoritesEmptyState() {
  const { t } = useTranslation("favorites");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const router = useRouter();

  return (
    <View style={st.wrap}>
      <View style={st.emblem}>
        <View style={st.glow} />
        <LinearGradient
          colors={[withAlpha(colors.brand.violet, 0.3, colors.brand.soft), withAlpha(colors.brand.accent, 0.22, colors.brand.soft)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={st.emblemBox}
        >
          <Feather name="heart" size={30} color={colors.brand.light} />
        </LinearGradient>
      </View>
      <Text style={st.title}>{t("emptyTitle")}</Text>
      <Text style={st.body}>{t("emptyBody")}</Text>

      <View style={st.steps}>
        {STEPS.map(({ icon, key }) => (
          <View key={key} style={st.step}>
            <View style={st.stepIcon}>
              <Feather name={icon} size={16} color={colors.brand.light} />
            </View>
            <Text style={st.stepText}>{t(key)}</Text>
          </View>
        ))}
      </View>

      <View style={st.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/libraries")}
          style={({ pressed }) => [st.primary, pressed && { opacity: 0.85 }]}
        >
          <Text style={st.primaryText}>{t("emptyBrowse")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate("/for-you")}
          style={({ pressed }) => [st.ghost, pressed && { opacity: 0.8 }]}
        >
          <Text style={st.ghostText}>{t("emptyForYou")}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { alignItems: "center", paddingHorizontal: spacing.xl, paddingTop: 40, paddingBottom: spacing.xxxl },
    emblem: { width: 96, height: 96, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
    // La lueur est une OMBRE colorée (iOS), statique : un disque translucide
    // faisait une pastille à bord franc, faute de dégradé radial. Elle vit sur
    // son propre calque, sous la tuile : le dégradé arrondi rogne ce qui
    // dépasse de lui, son ombre comprise. Fond opaque de page, pour que la
    // tuile translucide garde sa teinte et qu'iOS calcule l'ombre sans peine.
    glow: {
      position: "absolute",
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: t.colors.surface.s0,
      shadowColor: t.colors.brand.accent,
      shadowOpacity: 0.6,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 0 },
    },
    emblemBox: {
      width: 72,
      height: 72,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: t.colors.brand.glow,
    },
    title: { fontSize: 20, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.4, color: t.colors.text.primary, textAlign: "center" },
    body: { ...typography.caption, fontSize: 14, lineHeight: 21, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary, textAlign: "center", marginTop: spacing.sm, maxWidth: 320 },
    steps: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.lg, maxWidth: 360, width: "100%", marginHorizontal: "auto" },
    step: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    stepIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.soft },
    stepText: { flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
    actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.lg, maxWidth: 360, width: "100%", marginHorizontal: "auto" },
    primary: { minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, backgroundColor: t.colors.cta.primaryBg },
    primaryText: { fontSize: 15, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.primaryFg },
    ghost: { minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: t.colors.border.subtle },
    ghostText: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
  });
