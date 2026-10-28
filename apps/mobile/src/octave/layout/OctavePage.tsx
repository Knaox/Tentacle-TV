/**
 * Octave (mobile) — une PAGE du mode, prête à l'emploi : fond d'encre, grand
 * titre qui se replie dans l'en-tête de verre, marges du chrome ; le contenu arrive en montant à peine
 * (`enterMotion`). Deux formes :
 * - `<OctavePage title>` : un défilement simple (peu de contenu, étagères) ;
 * - pour une LONGUE liste, `useOctavePageScroll()` sur un `Animated.FlatList`
 *   + `<OctaveLargeTitle>` en tête de liste + `<OctaveTopBar>` (virtualisée).
 */

import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useOctaveColors } from "../theme/octaveColors";
import { enterAnimation } from "./enterMotion";
import { OctaveTopBar } from "./OctaveTopBar";
import { useOctaveLayout } from "./useOctaveLayout";
import { useOctavePageScroll } from "./useOctavePageScroll";

interface LargeTitleProps {
  title: string;
  subtitle?: string;
  scrollY?: SharedValue<number>;
  /** À droite du titre (bouton, avatar). */
  accessory?: ReactNode;
}

/** Le grand titre d'une page : il s'efface en remontant pendant que le titre compact de l'en-tête paraît. */
export const OctaveLargeTitle = memo(function OctaveLargeTitle({ title, subtitle, scrollY, accessory }: LargeTitleProps) {
  const colors = useOctaveColors();
  const { gutter } = useOctaveLayout();
  const fade = useAnimatedStyle(() => {
    const y = scrollY?.value ?? 0;
    return {
      opacity: interpolate(y, [0, 40], [1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(y, [-120, 0], [1.08, 1], Extrapolation.CLAMP) }],
    };
  });
  return (
    <View style={[styles.titleRow, { paddingHorizontal: gutter }]}>
      <Animated.View style={[styles.titleBlock, fade]}>
        <Text style={[styles.largeTitle, { color: colors.text }]} accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </Animated.View>
      {accessory}
    </View>
  );
});

interface PageProps {
  title: string;
  subtitle?: string;
  /** Actions de l'en-tête, à droite. */
  right?: ReactNode;
  accessory?: ReactNode;
  back?: boolean;
  children: ReactNode;
}

export function OctavePage({ title, subtitle, right, accessory, back, children }: PageProps) {
  const colors = useOctaveColors();
  const { scrollY, scrollProps } = useOctavePageScroll();
  return (
    <View style={[styles.page, { backgroundColor: colors.ink }]}>
      <Animated.ScrollView {...scrollProps} showsVerticalScrollIndicator={false}>
        <OctaveLargeTitle title={title} subtitle={subtitle} scrollY={scrollY} accessory={accessory} />
        <Animated.View entering={enterAnimation()}>{children}</Animated.View>
      </Animated.ScrollView>
      <OctaveTopBar scrollY={scrollY} title={title} right={right} back={back} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 16 },
  titleBlock: { flex: 1, transformOrigin: "left" },
  largeTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -0.6 },
  subtitle: { fontSize: 15, marginTop: 4 },
});
