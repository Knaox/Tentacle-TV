import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { DetailPlayCta } from "@/components/detail/DetailPlayCta";
import type { DetailPlayCta as Cta } from "@/components/detail/computeBadges";
import type { useMediaDetailAnimations } from "@/hooks/useMediaDetailAnimations";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { OfflineDetailMetrics } from "./OfflineDetailShell";
import { OfflineLocalImage } from "./OfflineLocalImage";

interface Props {
  item: MediaItem;
  cta: Cta;
  /** « Qualité d'origine · 4,2 Gio », « 2 saisons · 14 épisodes · … » : ce qui est ici. */
  deviceParts: ReadonlyArray<string | null>;
  actions: ReactNode;
  anims: ReturnType<typeof useMediaDetailAnimations>;
}

/**
 * Sous la scène d'une fiche locale : Lecture au dégradé de marque (le bouton
 * de la fiche en ligne, anneau d'avancement et temps restant compris), la
 * ligne « Sur l'appareil » qui dit ce que l'appareil garde, puis les actions.
 */
export function OfflineStageHeader({ item, cta, deviceParts, actions, anims }: Props) {
  const router = useRouter();
  return (
    <>
      {cta.targetId && (
        <Animated.View style={[{ marginTop: spacing.xl, alignItems: "center", paddingHorizontal: spacing.screenPadding }, anims.actionsStyle]}>
          <DetailPlayCta cta={cta} title={item.Name} onPress={() => router.push(`/watch/${cta.targetId}` as never)} />
        </Animated.View>
      )}
      <Animated.View style={anims.actionsStyle}>
        <OfflineDeviceLine parts={deviceParts} />
        {actions}
      </Animated.View>
    </>
  );
}

interface RailProps extends Props {
  metrics: OfflineDetailMetrics;
  /** Visuel 2:3 du snapshot et ses candidats (affiche du film, de la série). */
  posterItemId: string;
  posterCandidates: readonly string[];
  /** Le bloc titre, en ton « page » (colonne voilée de l'iPad paysage). */
  stage: ReactNode;
}

/** Paysage tablette : la colonne gauche reprend tout — affiche, bloc titre, Lecture, actions. */
export function OfflineStageRail({ posterItemId, posterCandidates, metrics, stage, ...header }: RailProps) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      <Animated.View style={[{ width: metrics.posterW, height: metrics.posterH }, header.anims.posterStyle]}>
        <View style={{ width: metrics.posterW, height: metrics.posterH, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: theme.colors.surface.s2, shadowColor: "#000", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 22 }}>
          <OfflineLocalImage itemId={posterItemId} candidates={posterCandidates} style={StyleSheet.absoluteFill} />
        </View>
      </Animated.View>
      <View style={{ marginTop: spacing.lg }}>{stage}</View>
      <OfflineStageHeader {...header} />
    </View>
  );
}

/** « Sur l'appareil · Qualité d'origine · 4,2 Gio » — ce que l'appareil garde de ce titre. */
function OfflineDeviceLine({ parts }: { parts: ReadonlyArray<string | null> }) {
  const { t } = useTranslation("offline");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const shown = parts.filter((part): part is string => part !== null && part !== "");
  return (
    <View style={st.line} accessible accessibilityLabel={[t("stateOnDevice"), ...shown].join(", ")}>
      <Feather name="smartphone" size={13} color={theme.colors.brand.light} />
      <Text style={st.lead}>{t("stateOnDevice")}</Text>
      {shown.map((part) => (
        <Text key={part} style={st.part}>
          <Text style={st.dot}>·  </Text>
          {part}
        </Text>
      ))}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    line: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      columnGap: 8,
      rowGap: 2,
      marginTop: spacing.md,
      paddingHorizontal: spacing.screenPadding,
    },
    lead: { fontSize: 12.5, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    part: { fontSize: 12.5, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary, fontVariant: ["tabular-nums"] },
    dot: { color: t.colors.text.quaternary },
  });
