import { memo, useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GlassSurface } from "@/components/ui";
import { HEADER_COLLAPSE_SHIFT, useHeaderHeight } from "@/components/PersistentHeader";
import { useScrollChromeValue } from "@/components/navigation/scrollChrome";
import { FONT_FAMILY, motion, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import type { RecoSection } from "./useRecoSection";

/** Hauteur dessinée de la pastille (la zone tactile de chaque moitié : 44 pt). */
const PILL_HEIGHT = 44;
const PILL_PADDING = 3;
/** Écart entre l'en-tête et la pastille, puis entre la pastille et la page. */
const GAP = spacing.sm;
/** Largeur au plus : sur iPad, deux mots n'ont pas à traverser l'écran. */
const PILL_MAX_WIDTH = 420;
const SLIDE_MS = 220;

/**
 * La place que la barre prend sous l'en-tête : les deux sections la
 * réservent en tête de leur contenu (le contenu défile DESSOUS, comme sous
 * l'en-tête).
 */
export const RECO_SECTION_BAR_SPACE = GAP + PILL_HEIGHT + GAP;

const SECTIONS: readonly RecoSection[] = ["forYou", "refine"];

interface Props {
  section: RecoSection;
  onChange: (next: RecoSection) => void;
}

/**
 * « Pour vous · Affiner » — une pastille en verre FIXÉE sous l'en-tête, en
 * deux moitiés égales, toujours visible : l'ancien segment compact défilait
 * avec la page et passait sous l'en-tête dès le premier geste.
 *
 * Le pouce NEUTRE GLISSE d'une moitié à l'autre (transform seul, aucune
 * remise en page) : celui des segmentés de réglage, comme le sélecteur
 * segmenté d'Apple — gris levé en sombre, blanc en clair, jamais le dégradé
 * de marque (mêmes valeurs que `selectedOptionLook` des boutons du mobile). Le verre n'est jamais masqué : il est là
 * parce que la page défile dessous. Pas de pages qu'on fait glisser : la pile
 * d'« Affiner » se juge déjà d'un glisser horizontal, les deux gestes se
 * seraient battus.
 */
export const RecoSectionBar = memo(function RecoSectionBar({ section, onChange }: Props) {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const headerH = useHeaderHeight();
  const thumbLook = theme.isDark ? st.thumbDark : st.thumbLight;

  const [half, setHalf] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setHalf((e.nativeEvent.layout.width - PILL_PADDING * 2) / 2);
  }, []);

  const index = section === "refine" ? 1 : 0;
  const offset = useSharedValue(index);
  useEffect(() => {
    offset.value = withTiming(index, { duration: motion.respectReducedMotion(SLIDE_MS) });
  }, [index, offset]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value * half }] }), [half]);

  // L'en-tête remonte de huit points au défilement : la barre le suit, sans
  // quoi une bande de contenu apparaîtrait entre les deux.
  const fallback = useSharedValue(0);
  const collapsed = useScrollChromeValue() ?? fallback;
  const followStyle = useAnimatedStyle(() => ({ transform: [{ translateY: collapsed.value * -HEADER_COLLAPSE_SHIFT }] }));

  const select = useCallback((next: RecoSection) => {
    if (next === section) return;
    haptic("select");
    onChange(next);
  }, [section, onChange]);

  return (
    <Animated.View style={[st.wrap, { top: headerH + GAP }, followStyle]} pointerEvents="box-none">
      <GlassSurface tier="dropdown" radius={PILL_HEIGHT / 2} style={st.pill}>
        <View style={st.track} onLayout={onLayout} accessibilityRole="tablist" accessibilityLabel={t("sectionsLabel")}>
          {half > 0 && (
            <Animated.View style={[st.thumb, thumbLook, { width: half }, thumbStyle]} pointerEvents="none" />
          )}
          {SECTIONS.map((value) => {
            const active = value === section;
            return (
              <Pressable
                key={value}
                onPress={() => select(value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [st.segment, pressed && !active && st.pressed]}
              >
                <Text style={[st.label, active && st.labelActive]} numberOfLines={1}>
                  {t(value === "refine" ? "sectionRefine" : "sectionForYou")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </Animated.View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 0,
      right: 0,
      zIndex: 15,
      alignItems: "center",
      paddingHorizontal: spacing.screenPadding,
    },
    pill: { width: "100%", maxWidth: PILL_MAX_WIDTH, height: PILL_HEIGHT },
    track: { flex: 1, flexDirection: "row", padding: PILL_PADDING },
    thumb: {
      position: "absolute",
      top: PILL_PADDING,
      bottom: PILL_PADDING,
      left: PILL_PADDING,
      borderRadius: (PILL_HEIGHT - PILL_PADDING * 2) / 2,
    },
    thumbDark: { backgroundColor: "rgba(255, 255, 255, 0.18)" },
    thumbLight: {
      backgroundColor: "#FFFFFF",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 3,
    },
    segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: PILL_HEIGHT / 2 },
    pressed: { opacity: 0.6 },
    label: { ...typography.small, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    labelActive: { fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  });
