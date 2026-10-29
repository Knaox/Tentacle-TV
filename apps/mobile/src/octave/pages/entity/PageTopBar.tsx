/**
 * Octave mobile — la barre du haut d'une page poussée (album, artiste,
 * ambiance) : un retour en verre (44 pt), et le titre qui apparaît en fondu
 * quand la tête de page est passée (`scrollY`), et à droite ce que la page y pose
 * (`right` : le cœur d'un album, d'un artiste). Le retour par glissement du
 * système reste entier : rien ne le recouvre.
 */

import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react-native";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { GlassBackdrop, GlassSurface } from "@/components/ui";
import { typography, useTheme } from "@/theme";

export const PageTopBar = memo(function PageTopBar({ title, scrollY, threshold, right }: { title: string; scrollY: SharedValue<number>; threshold: number; right?: ReactNode }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shown = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [threshold - 40, threshold], [0, 1], Extrapolation.CLAMP) }));
  const back = () => (router.canGoBack() ? router.back() : router.replace(octavePaths.home as never));
  return (
    <View pointerEvents="box-none" style={[styles.bar, { paddingTop: insets.top, height: insets.top + 52 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shown]}>
        <GlassBackdrop />
      </Animated.View>
      <Pressable onPress={back} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("common.back")} style={styles.backWrap}>
        <GlassSurface tier="subtle" tint="regular" radius={22} interactive style={styles.back}>
          <ChevronLeft size={22} color={theme.colors.text.primary} />
        </GlassSurface>
      </Pressable>
      <Animated.View pointerEvents="none" style={[styles.titleWrap, { marginRight: right ? 0 : 44 }, shown]}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
          {title}
        </Text>
      </Animated.View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, zIndex: 10 },
  backWrap: { width: 44, height: 44 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1, alignItems: "center" },
  right: { minWidth: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
});
