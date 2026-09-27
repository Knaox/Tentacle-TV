import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, useTheme, useThemedStyles, withAlpha } from "@/theme";
import { TentacleLogo } from "../TentacleLogo";
import { FadeIn, GlassCard, SubtleBackground, makeAuthStyles } from "./authStyles";
import { LanguageToggle } from "./LanguageToggle";

interface AuthScreenFrameProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Sous la carte : liens secondaires. */
  footer?: ReactNode;
  /** Retour (inscription, mot de passe oublié) — 44 pt, en haut à gauche. */
  onBack?: () => void;
  /** Choix de langue en haut à droite (écrans d'entrée : serveur, connexion). */
  showLanguage?: boolean;
  logoSize?: number;
}

/**
 * Le cadre commun des écrans d'avant connexion du mobile : fond de marque
 * FIXE (orbe violet en haut, rose en bas — rien n'y bouge), barre haute
 * (retour, langue) sous l'encoche, logo « l'Étreinte », puis la carte de verre.
 * Le contenu défile : clavier ouvert, iPhone SE ou paysage, rien n'est coupé.
 */
export function AuthScreenFrame({ title, subtitle, children, footer, onBack, showLanguage = false, logoSize = 72 }: AuthScreenFrameProps) {
  const { t } = useTranslation("auth");
  const { colors } = useTheme();
  const auth = useThemedStyles(makeAuthStyles);
  const insets = useSafeAreaInsets();

  return (
    <SubtleBackground ambient>
      <LinearGradient
        colors={["transparent", withAlpha(colors.brand.accent, 0.1, "transparent")]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 280 }}
        pointerEvents="none"
      />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: Math.max(insets.top, 12) + 4,
          paddingLeft: Math.max(insets.left, 8),
          paddingRight: Math.max(insets.right, 16),
          minHeight: 52,
        }}
      >
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t("backToSignIn")}
            hitSlop={6}
            style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name="chevron-left" size={26} color={colors.text.primary} />
          </Pressable>
        ) : <View />}
        {showLanguage && <LanguageToggle />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
            paddingTop: 8,
          }}
        >
          <FadeIn delay={0} translateY={12} style={{ alignItems: "center", marginBottom: 20 }}>
            <View accessible accessibilityLabel={t("tentacle")} accessibilityRole="image">
              <TentacleLogo size={logoSize} />
            </View>
            <Text
              style={{ marginTop: 10, color: colors.text.tertiary, fontSize: 11, letterSpacing: 2.4, fontFamily: FONT_FAMILY.semibold }}
              importantForAccessibility="no"
              accessibilityElementsHidden
            >
              {t("tentacle").toUpperCase()}
            </Text>
          </FadeIn>

          <FadeIn delay={80} translateY={14} style={{ width: "100%", maxWidth: 420 }}>
            <GlassCard style={{ padding: 24 }}>
              <Text style={[auth.title, { textAlign: "left", fontSize: 26 }]} accessibilityRole="header">{title}</Text>
              {!!subtitle && (
                <Text style={[auth.subtitle, { textAlign: "left", color: colors.text.tertiary, fontFamily: FONT_FAMILY.regular, letterSpacing: 0, fontSize: 14, lineHeight: 20 }]}>
                  {subtitle}
                </Text>
              )}
              {children}
            </GlassCard>
            {footer && <View style={{ marginTop: 12, alignItems: "center" }}>{footer}</View>}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SubtleBackground>
  );
}
