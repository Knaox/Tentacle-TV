import { useEffect } from "react";
import { AccessibilityInfo, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { retainModal } from "@/components/ui/modalGate";
import { PlainButton, PrimaryButton } from "@/components/ui/buttons";
import { CONTENT_MAX_WIDTH, ctaGradient, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { MODAL_ORIENTATIONS } from "../modalOrientations";
import { FIRST_RUN_PROGRESS_KEY, FIRST_RUN_SKIP_KEY, firstRunPrimaryKey, firstRunStepOf, type FirstRunStep } from "@tentacle-tv/shared";
import { HomeRowsStep } from "./HomeRowsStep";

interface FirstRunCardProps {
  step: FirstRunStep;
  /** 1 à `total`. */
  position: number;
  total: number;
  /** L'action de l'étape : poser le code, choisir la photo, continuer. */
  onPrimary: () => void;
  /** « Passer » (absent pour l'accueil : « Continuer » suffit, rien n'est imposé). */
  onSkip?: () => void;
}

/**
 * Une étape du premier lancement, en PLEIN ÉCRAN : l'avancée (« Étape 2 sur
 * 3 »), le titre, l'explication, le contenu de l'étape, puis le pied fixe —
 * l'action principale et « Passer ». Centrée et bornée (`CONTENT_MAX_WIDTH`) :
 * propre en paysage sur l'iPad. Une modale à la fois (`modalGate`).
 */
export function FirstRunCard({ step, position, total, onPrimary, onSkip }: FirstRunCardProps) {
  const { t } = useTranslation(["familyMobile", "profilePicker"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const gradient = ctaGradient(theme.colors.brand);
  const last = position === total;
  // Textes, icône, contenu : le catalogue partagé (shared `firstRun/firstRunCatalog.ts`).
  const descriptor = firstRunStepOf(step);
  const copy = { title: t(descriptor.titleKey), body: t(descriptor.bodyKey), primary: t(firstRunPrimaryKey(step, last)) };

  useEffect(() => retainModal(), []);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(copy.title);
  }, [copy.title]);

  return (
    <Modal visible animationType="fade" statusBarTranslucent supportedOrientations={[...MODAL_ORIENTATIONS]} onRequestClose={onSkip ?? onPrimary}>
      <View style={[st.page, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.md }]}>
        <LinearGradient pointerEvents="none" colors={[theme.colors.brand.glow, "transparent"]} style={st.halo} />
        <ScrollView style={st.body} contentContainerStyle={st.scroll}>
          <View style={st.column}>
            <Text style={st.progress}>{t(FIRST_RUN_PROGRESS_KEY, { current: position, total })}</Text>
            <View style={st.dots} accessible={false}>
              {Array.from({ length: total }, (_, index) => (
                <View key={index} style={[st.dot, index < position && { backgroundColor: theme.colors.brand.light }]} />
              ))}
            </View>
            <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.badge}>
              <Feather name={descriptor.icon} size={26} color={theme.colors.cta.brandFg} />
            </LinearGradient>
            <Text style={st.title} accessibilityRole="header">{copy.title}</Text>
            <Text style={st.text}>{copy.body}</Text>
            {descriptor.inline === "homeRowsEditor" ? <View style={st.content}><HomeRowsStep /></View> : null}
          </View>
        </ScrollView>
        <View style={st.footer}>
          {/* Le système de boutons : l'action de l'étape au dégradé, « Passer » en texte seul. */}
          <PrimaryButton size="lg" fullWidth label={copy.primary} onPress={onPrimary} />
          {onSkip ? <PlainButton label={t(FIRST_RUN_SKIP_KEY)} onPress={onSkip} style={st.skip} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: t.colors.surface.s0 },
    halo: { position: "absolute", left: 0, right: 0, top: 0, height: 260, opacity: 0.5 },
    body: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    column: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", alignItems: "center" },
    progress: { ...typography.small, color: t.colors.brand.light, letterSpacing: 1.2 },
    dots: { flexDirection: "row", gap: 6, marginTop: spacing.sm },
    dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: t.colors.fill.medium },
    badge: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: spacing.xl },
    title: { ...typography.title, color: t.colors.text.primary, textAlign: "center", marginTop: spacing.lg },
    text: { ...typography.body, color: t.colors.text.secondary, textAlign: "center", lineHeight: 22, marginTop: spacing.sm, maxWidth: 480 },
    content: { width: "100%", marginTop: spacing.xl },
    footer: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    skip: { alignSelf: "center", marginTop: spacing.sm },
  });
