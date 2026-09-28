import { type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { GradientOverlay, IconButton } from "@/components/ui";
import { DetailTopBar } from "@/components/detail/DetailTopBar";
import { StageFocus } from "@/components/detail/StageFocus";
import type { useMediaDetailAnimations } from "@/hooks/useMediaDetailAnimations";
import { backOrHome } from "@/utils/backOrHome";
import { spacing, DETAIL_MAX_WIDTH, useResponsive, useTheme, withAlpha } from "@/theme";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export interface OfflineDetailMetrics {
  backdropH: number;
  logoMaxW: number;
  logoMaxH: number;
  posterW: number;
  posterH: number;
  /** Paysage tablette : rail gauche + corps défilant. */
  twoCol: boolean;
}

/** La géométrie de la fiche en ligne (`MediaDetailScreen`), cote pour cote. */
export function useOfflineDetailMetrics(): OfflineDetailMetrics {
  const { width, height } = useWindowDimensions();
  const { isTablet, isLandscape } = useResponsive();
  const posterW = Math.min(200, Math.round(width * 0.32));
  return {
    backdropH: isTablet ? Math.min(860, Math.round(height * 0.64)) : Math.min(680, Math.round(height * 0.7)),
    logoMaxW: Math.min(isTablet ? 460 : 300, Math.round(width * 0.76)),
    logoMaxH: isTablet ? 140 : 96,
    posterW,
    posterH: Math.round(posterW * 1.5),
    twoCol: isTablet && isLandscape,
  };
}

interface Props {
  /** Le décor, lu sur le disque (`file://`) ; `null` : les voiles seuls. */
  backdropUri: string | null;
  /** Titre repris par la barre haute quand celui de la scène est parti. */
  title: string;
  anims: ReturnType<typeof useMediaDetailAnimations>;
  metrics: OfflineDetailMetrics;
  /** Portrait : le bloc titre, posé DANS le décor. */
  stage: ReactNode;
  /** Portrait : sous la scène — Lecture et les actions. */
  header: ReactNode;
  /** Paysage tablette : la colonne gauche — affiche, bloc titre, Lecture, actions. */
  rail: ReactNode;
  body: ReactNode;
}

/**
 * L'ossature des fiches locales — celle de `MediaDetailScreen`, ligne pour
 * ligne, avec le décor lu sur le disque. Portrait : la SCÈNE (décor sur 70 %
 * de l'écran, bloc titre posé dans son bas, assise radiale statique), puis
 * Lecture, les actions et le corps. Paysage tablette : fond voilé, rail gauche
 * figé qui démarre sous le retour, corps défilant.
 */
export function OfflineDetailShell({ backdropUri, title, anims, metrics, stage, header, rail, body }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isTablet } = useResponsive();
  const topInset = Math.max(insets.top, 24);

  if (metrics.twoCol) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
        {backdropUri && <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="none" transition={400} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.colors.surface.s0Tint, 0.86, theme.colors.overlay.scrimHeavy) }]} />
        <View pointerEvents="box-none" style={{ position: "absolute", top: topInset + 8, left: spacing.screenPadding, zIndex: 10 }}>
          <IconButton
            icon="←"
            size={isTablet ? 42 : 36}
            onPress={() => backOrHome(router)}
            accessibilityLabel={t("back")}
            bgColor={isTablet ? theme.colors.glass.tintStrong : theme.colors.glass.backdrop}
            style={isTablet ? { borderWidth: 1, borderColor: theme.colors.border.strong } : undefined}
          />
        </View>
        <View style={{ flex: 1, flexDirection: "row", width: "100%", maxWidth: 1180, alignSelf: "center", paddingTop: topInset + 8 }}>
          <ScrollView style={{ width: 380, flexGrow: 0 }} contentContainerStyle={{ paddingTop: 52, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
            {rail}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxxl + 40, paddingTop: spacing.sm }} showsVerticalScrollIndicator={false}>
            <Animated.View style={anims.contentStyle}>{body}</Animated.View>
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
      <AnimatedScrollView onScroll={anims.scrollHandler} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: spacing.xxxl + 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ width: "100%", minHeight: metrics.backdropH, justifyContent: "flex-end", overflow: "hidden", backgroundColor: theme.colors.surface.s2 }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, anims.backdropStyle]}>
            {backdropUri && (
              <Image source={{ uri: backdropUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" contentPosition={{ top: "30%", left: "50%" }} cachePolicy="none" transition={400} />
            )}
          </Animated.View>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <GradientOverlay direction="top" height={120 + insets.top} intensity="soft" />
            {/* Voile SOMBRE en clair (noir pur : le plafond 0,70 est dans la rampe). */}
            <GradientOverlay direction="bottom" height={metrics.backdropH * 0.8} intensity="detail" color={theme.isDark ? undefined : `rgb(${theme.colors.onMedia.scrimRgb})`} />
            <StageFocus />
          </View>
          <View pointerEvents="box-none" style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center", paddingHorizontal: spacing.screenPadding, paddingTop: topInset + 64, paddingBottom: spacing.sm }}>
            {stage}
          </View>
        </View>
        <View style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" }}>
          {header}
          <Animated.View style={anims.contentStyle}>{body}</Animated.View>
        </View>
      </AnimatedScrollView>
      {/* Même barre que la fiche serveur : elle protège la zone d'état dès le
          premier pixel, puis se remplit quand la scène est passée. */}
      <DetailTopBar title={title} scrollY={anims.scrollY} revealAt={metrics.backdropH * 0.82} onBack={() => backOrHome(router)} />
    </View>
  );
}
