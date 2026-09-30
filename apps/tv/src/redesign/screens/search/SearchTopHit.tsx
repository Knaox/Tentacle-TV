import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { ArtworkHalo } from "../../background/ArtworkHalo";
import { NEUTRAL_PALETTE } from "../../color/artworkPalette";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { MetaLine } from "../../hero/MetaLine";
import { TitleArt } from "../../hero/TitleArt";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, text, white } from "../../theme/tokens";
import { PersonPortrait } from "./PersonPortrait";
import type { SearchTopModel, SearchTopPersonModel, SearchTopTitleModel } from "./searchViewModel";

/**
 * Le meilleur résultat, en tête des résultats : une bannière qu'un seul appui
 * ouvre. Un titre y montre son fond, son logo, sa ligne d'identité et
 * POURQUOI il répond (« Avec Keira Knightley ») ; une personne, son portrait
 * et ce qu'elle représente ici — l'appui mène à sa filmographie. Seul
 * résultat (`tall`), elle prend la place d'un héros.
 *
 * Au focus : la bannière se soulève à peine (elle est large), sa lumière
 * s'allume — un halo serré, qui tient dans la marge de la colonne. Clé : `top`.
 */

export const TOP_HIT_HEIGHT = 320;
const TALL_HEIGHT = 500;
const RADIUS = 32;

function Reason({ label }: { label: string }) {
  return (
    <View style={styles.reason}>
      <Icon name="sparkles" size={24} color={colors.accentLight} />
      <Text style={styles.reasonText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function TitleFace({ top, label, tall }: { top: SearchTopTitleModel; label: string; tall: boolean }) {
  return (
    <>
      {top.backdropUri ? <Image source={{ uri: top.backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <LinearGradient
        colors={[scrim(0.92), scrim(0.72), scrim(0.12), scrim(0)]}
        locations={[0, 0.38, 0.72, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {tall ? <LinearGradient colors={[scrim(0), scrim(0.55)]} locations={[0.55, 1]} style={StyleSheet.absoluteFill} /> : null}
      <View style={[styles.titleContent, tall && styles.titleContentTall]}>
        <Text style={text.kicker} numberOfLines={1}>{label}</Text>
        <TitleArt title={top.title} logoUri={top.logoUri} maxWidth={tall ? 640 : 520} maxHeight={tall ? 170 : 112} fontSize={tall ? 80 : 60} />
        <MetaLine items={top.meta} />
        {top.reason ? <Reason label={top.reason} /> : null}
      </View>
      {top.progress !== undefined && top.progress > 0.01 ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(Math.min(1, top.progress) * 100)}%` }]} />
        </View>
      ) : null}
    </>
  );
}

function PersonFace({ top, label, tall }: { top: SearchTopPersonModel; label: string; tall: boolean }) {
  return (
    <>
      <LinearGradient colors={[white(0.1), white(0.03)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.personContent}>
        <PersonPortrait uri={top.imageUri} initials={top.initials} size={tall ? 300 : 216} />
        <View style={styles.personText}>
          <Text style={text.kicker} numberOfLines={1}>{label}</Text>
          <Text style={text.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{top.name}</Text>
          <Text style={[text.meta, styles.personDetail]} numberOfLines={1}>{top.detail}</Text>
          <View style={styles.action}>
            <Text style={styles.actionText} numberOfLines={1}>{top.action}</Text>
            <Icon name="chevronRight" size={26} color={colors.text} strokeWidth={2.4} />
          </View>
        </View>
      </View>
    </>
  );
}

function Body({ top, label, width, tall, focused }: { top: SearchTopModel; label: string; width: number; tall: boolean; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * p.value }, { scale: 1 + 0.02 * p.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * p.value }));
  const raised = useAnimatedStyle(() => ({ opacity: p.value }));
  const sheen = useAnimatedStyle(() => ({ opacity: 0.8 * p.value }));
  const palette = top.palette ?? NEUTRAL_PALETTE;
  const height = tall ? TALL_HEIGHT : TOP_HIT_HEIGHT;
  return (
    <Animated.View style={[{ width, height }, lift]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, halo]}>
        <ArtworkHalo width={width} height={height} radius={RADIUS} palette={palette} spread={10} blur={15} opacity={0.85} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, raised]} />
      <View style={[styles.frame, { width, height }]}>
        {top.kind === "title" ? <TitleFace top={top} label={label} tall={tall} /> : <PersonFace top={top} label={label} tall={tall} />}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheen]}>
          <LinearGradient
            colors={[white(0.14), white(0.03), white(0)]}
            locations={[0, 0.3, 0.55]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring]} />
      </View>
    </Animated.View>
  );
}

export const SearchTopHit = memo(function SearchTopHit({
  top,
  label,
  width,
  tall = false,
  onPress,
  onFocusChange,
}: {
  top: SearchTopModel;
  /** « Meilleur résultat ». */
  label: string;
  width: number;
  /** Le seul résultat : la bannière prend la place d'un héros. */
  tall?: boolean;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  return (
    <FocusTarget
      focusKey="top"
      onPress={onPress}
      onFocusChange={onFocusChange}
      accessibilityLabel={top.kind === "title" ? top.title : top.name}
    >
      {(focused) => <Body top={top} label={label} width={width} tall={tall} focused={focused} />}
    </FocusTarget>
  );
});

const styles = StyleSheet.create({
  frame: { borderRadius: RADIUS, overflow: "hidden", backgroundColor: colors.surface2 },
  ring: { borderRadius: RADIUS, borderWidth: 1, borderColor: white(0.14) },
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 26 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
  },
  titleContent: { position: "absolute", left: 52, top: 36, bottom: 36, width: 720, gap: 14, justifyContent: "center" },
  titleContentTall: { top: undefined, bottom: 56, justifyContent: "flex-end", gap: 18 },
  reason: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonText: { ...fonts.semibold, fontSize: 26, color: colors.accentLight, flexShrink: 1 },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: white(0.22) },
  fill: { height: 6, backgroundColor: colors.accent },
  personContent: { flex: 1, flexDirection: "row", alignItems: "center", gap: 44, paddingHorizontal: 52 },
  personText: { flex: 1, gap: 10 },
  personDetail: { color: white(0.8) },
  action: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  actionText: { ...fonts.bold, fontSize: 26, color: colors.text },
});
