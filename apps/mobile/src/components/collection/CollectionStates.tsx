import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { Skeleton } from "@/components/ui";
import { PlainButton, PrimaryButton } from "@/components/ui/buttons";
import { ctlGradient, FONT_FAMILY, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

type FeatherName = keyof typeof Feather.glyphMap;

/**
 * L'emblème des états vides du catalogue (`CatalogEmpty`) : pastille de 76
 * cerclée du dégradé de marque, icône 28 `brand.light`. Ma liste et Mes
 * favoris le reprennent : trois écrans, un seul dessin du vide.
 */
function Emblem({ icon }: { icon: FeatherName }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const gradient = ctlGradient(theme.colors.brand);
  return (
    <LinearGradient colors={gradient.colors} locations={gradient.locations} start={gradient.start} end={gradient.end} style={st.ring}>
      <View style={st.ringInner}>
        <Feather name={icon} size={28} color={theme.colors.brand.light} />
      </View>
    </LinearGradient>
  );
}

interface EmptyAction {
  label: string;
  icon?: FeatherName;
  onPress: () => void;
}

/**
 * Une collection VIDE : l'emblème du catalogue, titre, promesse, les étapes
 * éventuelles en lignes de 48, puis la sortie (`PrimaryButton` blanc, à la
 * taille de son libellé, centré) et la sortie secondaire en texte seul. `extra` : ce qui garde un sens sur une liste vide (le
 * partage des titres likés).
 */
export const CollectionEmptyState = memo(function CollectionEmptyState({ icon, title, body, steps, primary, secondary, extra }: {
  icon: FeatherName;
  title: string;
  body: string;
  steps?: { icon: FeatherName; label: string }[];
  primary: EmptyAction;
  secondary?: EmptyAction;
  extra?: ReactNode;
}) {
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.empty}>
      <Emblem icon={icon} />
      <Text style={st.title} accessibilityRole="header">{title}</Text>
      <Text style={st.body}>{body}</Text>

      {steps && (
        <View style={st.steps}>
          {steps.map((step) => (
            <View key={step.label} style={st.step}>
              <View style={st.stepIcon}>
                <Feather name={step.icon} size={16} color={colors.brand.light} />
              </View>
              <Text style={st.stepText}>{step.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={st.actions}>
        <PrimaryButton tone="contrast" size="lg" label={primary.label} icon={primary.icon} onPress={primary.onPress} />
        {secondary && <PlainButton label={secondary.label} icon={secondary.icon} onPress={secondary.onPress} />}
      </View>
      {extra ? <View style={st.extra}>{extra}</View> : null}
    </View>
  );
});

/**
 * La collection a des titres, mais l'étape n'en retient aucun : l'emblème du
 * catalogue, le message, et le bouton plein qui rend tout.
 */
export const CollectionNarrowEmpty = memo(function CollectionNarrowEmpty({ message, actionLabel, onAction }: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.empty}>
      <Emblem icon="filter" />
      <Text style={st.body}>{message}</Text>
      <PrimaryButton tone="contrast" label={actionLabel} onPress={onAction} style={st.ctaCompact} />
    </View>
  );
});

/** Le squelette de la vue liste : des lignes à la hauteur des vraies. */
export function ListSkeleton() {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.listSkeleton}>
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} width="100%" height={100} radius={16} />)}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  empty: { alignItems: "center", paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  ring: { width: 76, height: 76, borderRadius: 38, padding: 1.5, marginBottom: spacing.sm },
  ringInner: { flex: 1, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface.s1 },
  title: { ...typography.subtitle, fontSize: 20, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, textAlign: "center", letterSpacing: -0.4 },
  body: { ...typography.caption, fontSize: 14, lineHeight: 20, color: t.colors.text.tertiary, textAlign: "center", maxWidth: 320 },
  steps: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
  step: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.subtle,
    backgroundColor: t.colors.surface.s1,
  },
  stepIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.soft },
  stepText: { flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.regular, color: t.colors.text.secondary },
  actions: { alignItems: "center", gap: spacing.xs, marginTop: spacing.md },
  ctaCompact: { marginTop: spacing.md },
  extra: { marginTop: spacing.md },
  listSkeleton: { paddingHorizontal: spacing.screenPadding, gap: spacing.sm },
});
