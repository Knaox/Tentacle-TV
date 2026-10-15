import { useEffect } from "react";
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { retainModal } from "@/components/ui/modalGate";
import { ctaGradient, FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { MODAL_ORIENTATIONS } from "../modalOrientations";

/**
 * `joined` : juste après avoir accepté une invitation (« Bienvenue dans la
 * famille de … ») ; `startup` : « Action recommandée » au démarrage.
 */
export type FamilyPinSuggestVariant = "joined" | "startup";

interface FamilyPinSuggestModalProps {
  variant: FamilyPinSuggestVariant;
  /** Le propriétaire de la famille rejointe (`joined`). */
  owner?: string;
  /** « Poser un code PIN ». */
  onSet: () => void;
  /** « Configurer plus tard ». */
  onLater: () => void;
  /** Fermée sans réponse (retour Android, voile). */
  onClose: () => void;
}

const CARD_MAX_WIDTH = 440;

/**
 * La fenêtre de la suggestion du code PIN, centrée sur l'iPhone comme sur
 * l'iPad — le même habit que l'affiche d'invitation : halo de marque posé une
 * fois, sans flou ni animation. Une modale à la fois (`modalGate`).
 */
export function FamilyPinSuggestModal({ variant, owner, onSet, onLater, onClose }: FamilyPinSuggestModalProps) {
  const { t } = useTranslation("family");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const gradient = ctaGradient(theme.colors.brand);
  const joined = variant === "joined";
  const title = joined ? t("pinSuggest.joinedTitle", { owner: owner ?? "" }) : t("pinSuggest.title");

  useEffect(() => retainModal(), []);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(title);
  }, [title]);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent supportedOrientations={[...MODAL_ORIENTATIONS]} onRequestClose={onClose}>
      <View style={st.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={st.card} accessibilityViewIsModal>
          <LinearGradient pointerEvents="none" colors={[theme.colors.brand.glow, "transparent"]} style={st.halo} />
          <View style={st.head}>
            <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.badge}>
              <Feather name="lock" size={24} color={theme.colors.cta.brandFg} />
            </LinearGradient>
            <Text style={st.eyebrow}>{t("pinSuggest.eyebrow").toUpperCase()}</Text>
            <Text style={st.title} accessibilityRole="header">{title}</Text>
            <Text style={st.body}>{joined ? t("pinSuggest.joinedBody") : t("pinSuggest.body")}</Text>
          </View>

          <View style={st.why}>
            <Feather name="shield" size={18} color={theme.colors.brand.light} style={st.whyIcon} />
            <Text style={st.whyText}>{t("pinSuggest.why")}</Text>
          </View>

          <Pressable onPress={onSet} accessibilityRole="button" style={({ pressed }) => [st.primaryWrap, pressed && st.dim]}>
            <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.primary}>
              <Text style={st.primaryText}>{t("pinSuggest.set")}</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onLater} accessibilityRole="button" style={({ pressed }) => [st.ghost, pressed && st.ghostPressed]}>
            <Text style={st.ghostText}>{t("pinSuggest.later")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: t.colors.overlay.scrimHeavy,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      width: "100%",
      maxWidth: CARD_MAX_WIDTH,
      borderRadius: RADIUS.xl,
      backgroundColor: t.colors.surface.s1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      padding: spacing.xl,
      overflow: "hidden",
      ...t.colors.shadow.sheet,
    },
    halo: { position: "absolute", left: 0, right: 0, top: 0, height: 150, opacity: 0.6 },
    head: { alignItems: "center" },
    badge: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    eyebrow: { ...typography.small, color: t.colors.brand.light, letterSpacing: 1.4, marginTop: spacing.md },
    title: { ...typography.subtitle, color: t.colors.text.primary, textAlign: "center", marginTop: spacing.xs },
    body: { ...typography.body, color: t.colors.text.secondary, textAlign: "center", lineHeight: 21, marginTop: spacing.sm },
    why: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    whyIcon: { marginTop: 1 },
    whyText: { ...typography.body, color: t.colors.text.secondary, flex: 1, lineHeight: 21 },
    primaryWrap: { marginTop: spacing.lg, borderRadius: RADIUS.lg, overflow: "hidden" },
    primary: { minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
    primaryText: { ...typography.bodyBold, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.brandFg },
    ghost: { minHeight: 48, marginTop: spacing.sm, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center" },
    ghostPressed: { backgroundColor: t.colors.fill.subtle },
    ghostText: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    dim: { opacity: 0.55 },
  });
