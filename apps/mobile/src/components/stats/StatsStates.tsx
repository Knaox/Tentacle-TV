import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Skeleton } from "@/components/ui";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useStatsFormat } from "./useStatsFormat";

type FeatherName = keyof typeof Feather.glyphMap;

/** Le chargement, à la forme de l'écran rempli : la vue d'ensemble (chiffre et compteurs), le profil, deux cartes. */
export const StatsSkeleton = memo(function StatsSkeleton() {
  const st = useThemedStyles(makeStyles);
  const f = useStatsFormat();
  return (
    <View style={st.skeleton} accessible accessibilityLabel={f.t("loading")} accessibilityRole="progressbar">
      <Skeleton width="100%" height={300} radius={RADIUS.xl} />
      <Skeleton width="100%" height={150} radius={RADIUS.xl} />
      <Skeleton width="100%" height={250} radius={RADIUS.xl} />
      <Skeleton width="100%" height={230} radius={RADIUS.xl} />
    </View>
  );
});

function StateFrame({ icon, title, body, children }: { icon: FeatherName; title: string; body: string; children?: ReactNode }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.frame}>
      <View style={[st.badge, { backgroundColor: theme.colors.brand.ghost }]}>
        <Feather name={icon} size={26} color={theme.colors.brand.light} />
      </View>
      <Text style={st.title} accessibilityRole="header">{title}</Text>
      <Text style={st.body}>{body}</Text>
      {children}
    </View>
  );
}

function Cta({ label, icon, onPress }: { label: string; icon: FeatherName; onPress: () => void }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        st.cta,
        { backgroundColor: theme.colors.cta.primaryBg },
        // En clair, un fin liseré définit le bouton blanc sur fond clair.
        theme.colors.cta.primaryBorder ? { borderWidth: 1, borderColor: theme.colors.cta.primaryBorder } : null,
        pressed && st.pressed,
      ]}
    >
      <Feather name={icon} size={16} color={theme.colors.cta.primaryFg} />
      <Text style={[st.ctaTxt, { color: theme.colors.cta.primaryFg }]}>{label}</Text>
    </Pressable>
  );
}

/** Rien vu, jamais : l'écran promet ce qu'il montrera, et mène au catalogue. */
export const StatsNeverWatched = memo(function StatsNeverWatched() {
  const st = useThemedStyles(makeStyles);
  const theme = useTheme();
  const f = useStatsFormat();
  const router = useRouter();
  const steps: Array<[FeatherName, string]> = [["clock", f.t("emptyStepTime")], ["moon", f.t("emptyStepRhythm")], ["star", f.t("emptyStepTaste")]];
  return (
    <StateFrame icon="pie-chart" title={f.t("emptyTitle")} body={f.t("emptyBody")}>
      <View style={st.steps}>
        {steps.map(([icon, label]) => (
          <View key={label} style={st.step}>
            <Feather name={icon} size={16} color={theme.colors.brand.light} />
            <Text style={st.stepTxt}>{label}</Text>
          </View>
        ))}
      </View>
      <Cta label={f.t("emptyCta")} icon="compass" onPress={() => router.push("/libraries")} />
    </StateFrame>
  );
});

/** Une période vide alors que l'historique existe : on propose de voir plus large. */
export const StatsPeriodEmpty = memo(function StatsPeriodEmpty({ onShowAll }: { onShowAll: () => void }) {
  const f = useStatsFormat();
  return (
    <StateFrame icon="calendar" title={f.t("periodEmptyTitle")} body={f.t("periodEmptyBody")}>
      <Cta label={f.t("periodEmptyCta")} icon="clock" onPress={onShowAll} />
    </StateFrame>
  );
});

/** Échec : serveur trop ancien (la route n'existe pas) ou serveur injoignable. */
export const StatsFailure = memo(function StatsFailure({ outdated, onRetry }: { outdated: boolean; onRetry: () => void }) {
  const f = useStatsFormat();
  return outdated ? (
    <StateFrame icon="server" title={f.t("outdatedTitle")} body={f.t("outdatedBody")} />
  ) : (
    <StateFrame icon="alert-triangle" title={f.t("errorTitle")} body={f.t("errorBody")}>
      <Cta label={f.t("retry")} icon="refresh-cw" onPress={onRetry} />
    </StateFrame>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    skeleton: { gap: spacing.md },
    frame: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
    badge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 22, lineHeight: 28, textAlign: "center", fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary },
    body: { fontSize: 15, lineHeight: 22, textAlign: "center", fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    steps: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.xs },
    step: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    stepTxt: { flex: 1, fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    cta: { flexDirection: "row", alignItems: "center", gap: 8, height: 46, paddingHorizontal: 24, borderRadius: RADIUS.pill, marginTop: spacing.sm },
    pressed: { opacity: 0.8 },
    ctaTxt: { fontSize: 15, fontFamily: FONT_FAMILY.bold },
  });
