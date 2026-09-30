import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { TV_STAGE } from "@tentacle-tv/theme";
import { ArtworkHalo } from "../background/ArtworkHalo";
import type { ArtworkPalette } from "../color/artworkPalette";
import { PillButton } from "../controls/PillButton";
import { RoundButton } from "../controls/RoundButton";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, scrim, text, white } from "../theme/tokens";
import { MetaLine, type MetaItem } from "./MetaLine";
import { TitleArt } from "./TitleArt";

/**
 * La carte héros : l'œuvre en grand dans un cadre arrondi, sa lumière qui
 * déborde tout autour (le halo), et à gauche, sur un voile, de quoi la
 * lancer. Une seule action primaire — la pilule blanche.
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

export const HeroBanner = memo(function HeroBanner({
  hero,
  width,
  height = H.height,
  onPrimary,
  onSecondary,
  onToggleList,
  onFocusChange,
}: HeroBannerProps) {
  return (
    <View style={{ width, height }}>
      <ArtworkHalo width={width} height={height} radius={H.radius} palette={hero.palette} spread={H.haloSpread} />
      <View style={[styles.frame, { width, height, borderRadius: H.radius }]}>
        {hero.backdropUri ? <Image source={{ uri: hero.backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
        <LinearGradient
          colors={[scrim(0.9), scrim(0.62), scrim(0.05), scrim(0)]}
          locations={[0, 0.34, 0.64, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={[scrim(0), scrim(0.7)]} locations={[0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.ring, { borderRadius: H.radius }]} pointerEvents="none" />
        <View style={styles.content}>
          {hero.kicker && hero.reason ? (
            <View style={styles.kickerBlock}>
              <Text style={text.kicker} numberOfLines={1}>{hero.kicker}</Text>
              <View style={styles.reason}>
                <Icon name="sparkles" size={26} color={colors.accentLight} />
                <Text style={styles.reasonText} numberOfLines={1}>{hero.reason}</Text>
              </View>
            </View>
          ) : hero.kicker ? (
            <Text style={text.kicker} numberOfLines={1}>{hero.kicker}</Text>
          ) : null}
          <TitleArt title={hero.title} logoUri={hero.logoUri} maxWidth={680} maxHeight={hero.reason ? 140 : 170} />
          <MetaLine items={hero.meta} />
          {hero.synopsis ? <Text style={[text.body, styles.synopsis]} numberOfLines={hero.reason ? 2 : 3}>{hero.synopsis}</Text> : null}
          <View style={styles.actions}>
            <PillButton variant="brand" {...hero.primary} onPress={onPrimary} onFocusChange={onFocusChange} />
            {hero.secondary ? <PillButton variant="glass" {...hero.secondary} onPress={onSecondary} onFocusChange={onFocusChange} /> : null}
            {hero.listToggle ? (
              <RoundButton
                icon="plus"
                activeIcon="check"
                label={hero.listToggle.label}
                active={hero.listToggle.active}
                focusKey={hero.listToggle.focusKey}
                onPress={onToggleList}
                onFocusChange={onFocusChange}
              />
            ) : null}
          </View>
        </View>
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
  content: { position: "absolute", left: 72, top: 84, width: 820, gap: 20 },
  kickerBlock: { gap: 12 },
  reason: { flexDirection: "row", alignItems: "center", gap: 10 },
  reasonText: { ...fonts.semibold, fontSize: 27, color: white(0.92), flexShrink: 1 },
  synopsis: { maxWidth: 760, color: white(0.86) },
  actions: { flexDirection: "row", gap: 18, marginTop: 10 },
  dots: { position: "absolute", right: 56, bottom: 44, flexDirection: "row", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: white(0.4) },
  dotActive: { width: 34, backgroundColor: colors.text },
});
