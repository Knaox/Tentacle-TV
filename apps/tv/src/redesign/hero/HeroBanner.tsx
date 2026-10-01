import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_MOTION, TV_STAGE } from "@tentacle-tv/theme";
import { ArtworkHalo } from "../background/ArtworkHalo";
import type { ArtworkPalette } from "../color/artworkPalette";
import { PillButton } from "../controls/PillButton";
import { RoundButton } from "../controls/RoundButton";
import { Icon, type IconName } from "../icons/Icon";
import { useCrossfade } from "../motion/useCrossfade";
import { useSwap } from "../motion/useSwap";
import { colors, fonts, scrim, text, white } from "../theme/tokens";
import { MetaLine, type MetaItem } from "./MetaLine";
import { TitleArt } from "./TitleArt";

/**
 * La carte héros : l'œuvre en grand dans un cadre arrondi, sa lumière qui
 * déborde tout autour (le halo), et à gauche, sur un voile, de quoi la
 * lancer. Une seule action primaire — la pilule de lecture, au dégradé de la
 * marque.
 *
 * Le contenu est calé en BAS, à la même distance du bord que de la gauche
 * (`INSET`) : calé en haut, sa hauteur variable (raison, logo ou titre écrit,
 * métadonnées sur deux rangées, synopsis) poussait les boutons contre le bord
 * bas — jusqu'à les rogner sous un titre écrit sur deux lignes. D'où aussi un
 * synopsis sur deux lignes, et un logo ou un titre bornés (moins haut quand la
 * raison prend une ligne) : le haut du bloc garde toujours de l'air.
 *
 * Quand le héros TOURNE (Apple TV) : la nouvelle image entre en fondu
 * par-dessus l'ancienne, qui reste pleine dessous (`useCrossfade`,
 * `dissolve`) ; le halo passe d'une lumière à l'autre ; le bloc du texte et
 * des boutons — un seul exemplaire, il est focalisable — sort en fondu,
 * change pendant qu'il est invisible, et rentre en montant de quelques
 * points (`useSwap`). Les points de la rotation suivent tout de suite.
 */

export interface HeroAction {
  label: string;
  icon?: IconName;
  progress?: number;
  focusKey: string;
}

export interface HeroModel {
  id: string;
  kicker?: string;
  /** La suite du surtitre, sur sa propre ligne : pourquoi ce titre est là
   *  (« Parce que vous avez aimé … »). Le logo et le synopsis se resserrent. */
  reason?: string;
  title: string;
  logoUri?: string;
  backdropUri?: string;
  meta: MetaItem[];
  synopsis?: string;
  palette: ArtworkPalette;
  primary: HeroAction;
  secondary?: HeroAction;
  /** Le rond « Ma liste » : plus quand le titre n'y est pas, coche sinon. */
  listToggle?: { label: string; active: boolean; focusKey: string };
  /** Position dans la rotation (points en bas à droite). */
  page?: { index: number; count: number };
}

export interface HeroBannerProps {
  hero: HeroModel;
  width: number;
  height?: number;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onToggleList?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const H = TV_STAGE.hero;
/** La marge du contenu, à gauche comme en bas. */
const INSET = 72;
const ACTIONS_HEIGHT = 68;
const DOT = 8;
const TITLE_WIDTH = 760;
/** Ce que le texte d'un héros qui arrive monte, en points. */
const TEXT_RISE = 10;

/** Le titre écrit (faute de logo) : assez petit pour tenir en deux lignes
 *  sans que iOS le rétrécisse — rétréci, il garde son interligne et ses deux
 *  lignes se décollent. Un cran plus bas quand la raison prend une ligne. */
function titleSize(title: string, withReason: boolean): number {
  const size = title.length <= 14 ? 76 : title.length <= 24 ? 68 : 58;
  return withReason ? size - 8 : size;
}

export const HeroBanner = memo(function HeroBanner({
  hero,
  width,
  height = H.height,
  onPrimary,
  onSecondary,
  onToggleList,
  onFocusChange,
}: HeroBannerProps) {
  const backdrops = useCrossfade(`${hero.id}|${hero.backdropUri ?? ""}`, hero.backdropUri, "hero", "dissolve");
  const { shown, progress } = useSwap(hero.id, hero, TV_MOTION.crossfade.heroTextOutMs, TV_MOTION.crossfade.heroTextInMs);
  const arrive = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: TEXT_RISE * (1 - progress.value) }] }));
  return (
    <View style={{ width, height }}>
      <ArtworkHalo width={width} height={height} radius={H.radius} palette={hero.palette} spread={H.haloSpread} opacity={H.haloOpacity} />
      <View style={[styles.frame, { width, height, borderRadius: H.radius }]}>
        {backdrops.map(({ entry, style }) =>
          entry.item ? (
            <Animated.View key={entry.key} pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
              <Image source={{ uri: entry.item }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
            </Animated.View>
          ) : null,
        )}
        <LinearGradient
          colors={[scrim(0.9), scrim(0.62), scrim(0.05), scrim(0)]}
          locations={[0, 0.34, 0.64, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={[scrim(0), scrim(0.7)]} locations={[0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: H.radius }]} pointerEvents="none" />
        <Animated.View style={[styles.content, arrive]}>
          {shown.kicker && shown.reason ? (
            <View style={styles.kickerBlock}>
              <Text style={text.kicker} numberOfLines={1}>{shown.kicker}</Text>
              <View style={styles.reason}>
                <Icon name="sparkles" size={26} color={colors.accentLight} />
                <Text style={styles.reasonText} numberOfLines={1}>{shown.reason}</Text>
              </View>
            </View>
          ) : shown.kicker ? (
            <Text style={text.kicker} numberOfLines={1}>{shown.kicker}</Text>
          ) : null}
          <TitleArt
            title={shown.title}
            logoUri={shown.logoUri}
            maxWidth={shown.logoUri ? 680 : TITLE_WIDTH}
            maxHeight={shown.reason ? 120 : 150}
            fontSize={titleSize(shown.title, Boolean(shown.reason))}
          />
          <MetaLine items={shown.meta} />
          {shown.synopsis ? <Text style={[text.body, styles.synopsis]} numberOfLines={2}>{shown.synopsis}</Text> : null}
          <View style={styles.actions}>
            <PillButton variant="brand" {...shown.primary} onPress={onPrimary} onFocusChange={onFocusChange} />
            {shown.secondary ? <PillButton variant="glass" {...shown.secondary} onPress={onSecondary} onFocusChange={onFocusChange} /> : null}
            {shown.listToggle ? (
              <RoundButton
                icon="plus"
                activeIcon="check"
                label={shown.listToggle.label}
                active={shown.listToggle.active}
                focusKey={shown.listToggle.focusKey}
                onPress={onToggleList}
                onFocusChange={onFocusChange}
              />
            ) : null}
          </View>
        </Animated.View>
        {hero.page && hero.page.count > 1 ? (
          <View style={styles.dots}>
            {Array.from({ length: hero.page.count }, (_, i) => (
              <View key={i} style={[styles.dot, i === hero.page!.index && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: colors.surface2 },
  ring: { borderWidth: 1, borderColor: white(0.14) },
  content: { position: "absolute", left: INSET, bottom: INSET, width: 820, gap: 18 },
  kickerBlock: { gap: 12 },
  reason: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonText: { ...fonts.semibold, fontSize: 27, color: white(0.92), flexShrink: 1 },
  synopsis: { maxWidth: 760, color: white(0.86) },
  actions: { flexDirection: "row", gap: 18, marginTop: 10 },
  // Les points de la rotation, sur la ligne des boutons.
  dots: { position: "absolute", right: 56, bottom: INSET + (ACTIONS_HEIGHT - DOT) / 2, flexDirection: "row", gap: 10 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: white(0.4) },
  dotActive: { width: 34, backgroundColor: colors.text },
});
