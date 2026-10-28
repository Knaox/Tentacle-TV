/**
 * Octave (mobile) — l'EN-TÊTE d'une page : transparent au repos (le grand
 * titre est dans la page), il se pose en VERRE dès que le contenu passe dessous
 * — le fond flou de Tentacle (`GlassBackdrop`, celui de la barre d'une page
 * poussée) : le verre natif d'iOS 26 ne se dessine pas sous une opacité animée,
 * l'en-tête restait sans fond sur l'Accueil, le Compte et les Réglages —
 * et le titre compact apparaît quand le grand titre est sorti. Retour (rond de
 * verre) sur une page empilée ; actions à droite. Seulement des opacités et des
 * translations, sur le fil d'interface.
 */

import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react-native";
import { GlassBackdrop } from "@/components/ui";
import { useOctaveColors } from "../theme/octaveColors";
import { OctaveGlass } from "./OctaveGlass";
import { OCTAVE_TOP_BAR_HEIGHT } from "./useOctavePageScroll";
import { useOctaveLayout } from "./useOctaveLayout";

/** Hauteur à partir de laquelle le grand titre est sorti (le titre compact le remplace). */
export const LARGE_TITLE_SPAN = 44;

interface Props {
  scrollY: SharedValue<number>;
  title?: string;
  /** Rond « Retour » (page empilée). Par défaut : seulement si la pile peut revenir. */
  back?: boolean;
  right?: ReactNode;
}

export const OctaveTopBar = memo(function OctaveTopBar({ scrollY, title, back, right }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useOctaveColors();
  const router = useRouter();
  const { gutter } = useOctaveLayout();
  const { t } = useTranslation("octaveShell");
  const showBack = back ?? router.canGoBack();
  const glass = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP) }));
  const compact = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [LARGE_TITLE_SPAN - 12, LARGE_TITLE_SPAN + 8], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [LARGE_TITLE_SPAN - 12, LARGE_TITLE_SPAN + 8], [6, 0], Extrapolation.CLAMP) }],
  }));
  const height = insets.top + OCTAVE_TOP_BAR_HEIGHT;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { height }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, glass]}>
        <GlassBackdrop />
        <View style={[styles.hairline, { backgroundColor: colors.line }]} />
      </Animated.View>
      <View pointerEvents="box-none" style={[styles.row, { paddingTop: insets.top, paddingHorizontal: gutter - 4 }]}>
        <View style={styles.side}>
          {showBack ? (
            <OctaveGlass radius={20} style={styles.round} interactive>
              <Pressable onPress={() => router.back()} hitSlop={8} style={styles.roundHit} accessibilityRole="button" accessibilityLabel={t("mobile.back")}>
                <ChevronLeft size={24} color={colors.text} strokeWidth={2.2} />
              </Pressable>
            </OctaveGlass>
          ) : null}
        </View>
        {title ? (
          <Animated.Text style={[styles.title, { color: colors.text }, compact]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Animated.Text>
        ) : (
          <Text style={styles.title} />
        )}
        <View style={[styles.side, styles.right]}>{right}</View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  hairline: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  row: { flex: 1, flexDirection: "row", alignItems: "center" },
  side: { minWidth: 44, flexDirection: "row", alignItems: "center", gap: 8 },
  right: { justifyContent: "flex-end" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  round: { width: 40, height: 40 },
  roundHit: { flex: 1, alignItems: "center", justifyContent: "center" },
});
