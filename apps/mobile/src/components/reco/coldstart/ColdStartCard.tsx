import { memo, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { ColdStartTitle } from "@tentacle-tv/api-client";
import { PressableCard } from "@/components/ui";
import { typography, FONT_FAMILY, RADIUS, motion, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  title: ColdStartTitle;
  selected: boolean;
  width: number;
  onToggle: (title: ColdStartTitle, selected: boolean) => void;
}

/**
 * Une carte de la grille de démarrage à froid : toute l'affiche est la cible.
 * Sélection = anneau de marque + voile + coche — opacité et transform
 * seulement, ni flou ni ombre animée.
 */
export const ColdStartCard = memo(function ColdStartCard({ title, selected, width, onToggle }: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const client = useJellyfinClient();
  const poster = client.getImageUrl(title.jellyfinItemId, "Primary", { height: 360, quality: 85 });

  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: motion.respectReducedMotion(200) });
  }, [selected, progress]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.5 + progress.value * 0.5 }],
  }));

  return (
    <PressableCard
      onPress={() => onToggle(title, selected)}
      style={{ width }}
      accessibilityRole="checkbox"
      accessibilityLabel={title.year ? `${title.name} (${title.year})` : title.name}
      accessibilityState={{ checked: selected }}
    >
      <View style={[st.poster, selected && st.posterSelected]}>
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <Animated.View style={[StyleSheet.absoluteFill, veilStyle]} pointerEvents="none">
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.12)", "rgba(0,0,0,0.7)"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[st.check, checkStyle]} pointerEvents="none">
          <LinearGradient
            colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.checkFill}
          >
            <Feather name="check" size={15} color={theme.colors.cta.brandFg} />
          </LinearGradient>
        </Animated.View>
      </View>
      <Text numberOfLines={1} style={st.name}>{title.name}</Text>
      <Text numberOfLines={1} style={st.year}>{title.year ?? ""}</Text>
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: RADIUS.lg,
    overflow: "hidden" as const,
    backgroundColor: t.colors.surface.s2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  posterSelected: { borderColor: t.colors.brand.violet },
  check: { position: "absolute" as const, top: 8, right: 8, width: 28, height: 28 },
  checkFill: { flex: 1, borderRadius: 14, alignItems: "center" as const, justifyContent: "center" as const },
  name: { ...typography.small, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, marginTop: 8 },
  year: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 2 },
});
