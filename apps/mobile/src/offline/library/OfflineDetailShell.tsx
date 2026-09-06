import { type ReactNode } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { GradientOverlay, IconButton } from "@/components/ui";
import type { useMediaDetailAnimations } from "@/hooks/useMediaDetailAnimations";
import { backOrHome } from "@/utils/backOrHome";
import { spacing, DETAIL_MAX_WIDTH, useResponsive, useTheme, withAlpha } from "@/theme";
import { OfflineLocalImage } from "./OfflineLocalImage";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export interface OfflineDetailMetrics {
  backdropH: number;
  posterW: number;
  posterH: number;
  /** Paysage tablette : rail gauche figé + corps défilant. */
  twoCol: boolean;
}

/** La géométrie de la fiche en ligne (`MediaDetailScreen`), bornée sur grand écran. */
export function useOfflineDetailMetrics(): OfflineDetailMetrics {
  const { width, height } = useWindowDimensions();
  const { isTablet, isLandscape } = useResponsive();
  const backdropH = Math.min(isTablet ? 620 : 520, Math.round(height * 0.52));
  const posterW = Math.min(200, Math.round(width * 0.32));
  return { backdropH, posterW, posterH: Math.round(posterW * 1.5), twoCol: isTablet && isLandscape };
}

interface Props {
  /** L'item dont le snapshot porte la bannière. */
  backdropItemId: string;
  backdropCandidates: readonly string[];
  anims: ReturnType<typeof useMediaDetailAnimations>;
  metrics: OfflineDetailMetrics;
  header: ReactNode;
  body: ReactNode;
}

/**
 * L'ossature des fiches locales — les deux mises en page de
 * `MediaDetailScreen`, ligne pour ligne, avec la bannière lue dans le
 * snapshot : portrait = colonne unique et parallaxe, paysage tablette = fond
 * statique voilé, rail gauche figé et corps défilant. Le bouton retour vit sur
 * un wrapper absolu (`IconButton` pose `style` sur son Pressable interne).
 */
export function OfflineDetailShell({ backdropItemId, backdropCandidates, anims, metrics, header, body }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isTablet } = useResponsive();

  const backBtn = (
    <View pointerEvents="box-none" style={{ position: "absolute", top: Math.max(insets.top, 24) + 8, left: spacing.screenPadding, zIndex: 10 }}>
      <IconButton
        icon="←"
        size={isTablet ? 42 : 36}
        onPress={() => backOrHome(router)}
        accessibilityLabel={t("back")}
        bgColor={isTablet ? theme.colors.glass.tintStrong : theme.colors.glass.backdrop}
        style={isTablet ? { borderWidth: 1, borderColor: theme.colors.border.strong } : undefined}
      />
    </View>
  );
  const content = <Animated.View style={anims.contentStyle}>{body}</Animated.View>;

  if (metrics.twoCol) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surface.s2 }]}>
          <OfflineLocalImage itemId={backdropItemId} candidates={backdropCandidates} style={StyleSheet.absoluteFill} />
        </View>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.colors.surface.s0Tint, 0.86, theme.colors.overlay.scrimHeavy) }]} />
        {backBtn}
        <View style={{ flex: 1, flexDirection: "row", width: "100%", maxWidth: 1180, alignSelf: "center", paddingTop: Math.max(insets.top, 24) + 8 }}>
          <View style={{ width: 380 }}>{header}</View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxxl + 40, paddingTop: spacing.sm }} showsVerticalScrollIndicator={false}>
            {content}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
      <AnimatedScrollView onScroll={anims.scrollHandler} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: spacing.xxxl + 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ width: "100%", height: metrics.backdropH, overflow: "hidden", backgroundColor: theme.colors.surface.s2 }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, anims.backdropStyle]}>
            <OfflineLocalImage itemId={backdropItemId} candidates={backdropCandidates} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <GradientOverlay direction="top" height={120 + insets.top} intensity="soft" />
          {/* Voile SOMBRE en clair (noir pur : le plafond 0,70 est dans la rampe). */}
          <GradientOverlay direction="bottom" height={metrics.backdropH * 0.8} intensity="detail" color={theme.isDark ? undefined : `rgb(${theme.colors.onMedia.scrimRgb})`} />
        </View>
        {!isTablet && backBtn}
        <View style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" }}>
          {header}
          {content}
        </View>
      </AnimatedScrollView>
      {isTablet && backBtn}
    </View>
  );
}
