import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { OPEN_PAGE, PREVIEW_ZONE_FADE, PREVIEW_ZONE_PLAYBACK, heroChevrons } from "@tentacle-tv/tv-core";
import { SoftGradient } from "../background/SoftGradient";
import { Icon } from "../icons/Icon";
import { motionTo } from "../motion/motion";
import { Reveal } from "../motion/Reveal";
import { useSwap } from "../motion/useSwap";
import { ZoneBackdrop } from "../previewZone/ZoneBackdrop";
import { ZONE_HINT_PILL } from "../previewZone/zoneModel";
import { ZoneSynopsis } from "../previewZone/ZoneSynopsis";
import { colors, fonts, scrim, text, white } from "../theme/tokens";
import type { HeroModel } from "./heroTypes";
import { MetaLine } from "./MetaLine";
import { TitleArt } from "./TitleArt";

/**
 * Ce que la BANNIÈRE dessine (`HeroBanner`) : le fond du titre (fondu croisé,
 * `ZoneBackdrop`), son texte à gauche (surtitre, raison, logo, méta, résumé en
 * phrases entières), et — focalisée — l'indice « OK : … · Maintenir OK », les
 * chevrons qui disent où l'on peut tourner (tv-core `heroChevrons`) et les
 * points de la position. Le focus se dit par l'ombre seule.
 *
 * Pendant la bande-annonce (`watching`, jouée par la scène DERRIÈRE la
 * bannière), tout s'efface sauf le TITRE, posé en haut à gauche (décision de
 * Damien du 19/10) : des opacités seulement.
 */
const W = OPEN_PAGE.width - 176 - OPEN_PAGE.safeRight;
const H = OPEN_PAGE.heroHeight;
const R = OPEN_PAGE.heroRadius;

export const HeroBannerArt = memo(function HeroBannerArt({ hero, focused, watching, okHint, holdHint }: {
  hero: HeroModel;
  focused: boolean;
  watching: boolean;
  okHint: string;
  holdHint: string;
}) {
  const reduced = useReducedMotion();
  const watch = useSharedValue(0);
  const lift = useSharedValue(0);
  useEffect(() => {
    watch.value = motionTo(watching ? 1 : 0, watching ? PREVIEW_ZONE_PLAYBACK.recedeMs : PREVIEW_ZONE_PLAYBACK.returnMs, reduced);
  }, [watching, watch, reduced]);
  useEffect(() => {
    lift.value = motionTo(focused ? 1 : 0, "focus", reduced);
  }, [focused, lift, reduced]);
  const { shown, progress } = useSwap(hero.id, hero, PREVIEW_ZONE_FADE.textMs, PREVIEW_ZONE_FADE.textMs);
  const rest = useAnimatedStyle(() => ({ opacity: 1 - watch.value }));
  const shadow = useAnimatedStyle(() => ({ opacity: lift.value * (1 - watch.value) }));
  const textFade = useAnimatedStyle(() => ({ opacity: progress.value }));
  const watchTitle = useAnimatedStyle(() => ({ opacity: watch.value * progress.value }));
  const chevrons = heroChevrons(hero.page?.index ?? 0, hero.page?.count ?? 1);
  return (
    <>
      <Animated.View style={[styles.shadow, shadow]} />
      <Animated.View style={[styles.clip, rest]}>
        <ZoneBackdrop uri={hero.backdropUri ?? null} />
        <SoftGradient width={W} height={H} colors={[scrim(0.88), scrim(0.55), scrim(0)]} locations={[0, 0.34, 0.64]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} />
        <SoftGradient width={W} height={H} colors={[scrim(0), scrim(0.6)]} locations={[0.5, 1]} />
        <Animated.View style={[styles.text, textFade]}>
          {shown.kicker ? <Text style={text.kicker} numberOfLines={1}>{shown.kicker}</Text> : null}
          {shown.reason ? (
            <View style={styles.line}>
              <Icon name="sparkles" size={24} color={colors.accentLight} />
              <Text style={styles.reason} numberOfLines={1}>{shown.reason}</Text>
            </View>
          ) : null}
          <View style={styles.title}>
            <TitleArt title={shown.title} logoUri={shown.logoUri} maxWidth={shown.logoUri ? 560 : 820} maxHeight={130} fontSize={64} />
          </View>
          {shown.meta.length > 0 ? <MetaLine items={shown.meta} singleLine /> : null}
          {shown.synopsis ? <ZoneSynopsis synopsis={shown.synopsis} lines={2} width={820} /> : null}
        </Animated.View>
        <View style={styles.foot}>
          <Reveal shown={focused}>
            <View style={[ZONE_HINT_PILL, styles.line]}>
              <Icon name="remote" size={20} color={colors.textSecondary} strokeWidth={1.8} />
              <Text style={styles.hint} numberOfLines={1}>{`${okHint} · ${holdHint}`}</Text>
            </View>
          </Reveal>
          {hero.page && hero.page.count > 1 ? (
            <View style={styles.dots}>
              {Array.from({ length: hero.page.count }, (_, i) => <View key={i} style={[styles.dot, i === hero.page?.index && styles.dotOn]} />)}
            </View>
          ) : null}
        </View>
        <Reveal shown={focused && chevrons.back} style={[styles.chevron, styles.chevronLeft]}>
          <View style={styles.chevronDisc}><Icon name="chevronLeft" size={30} color={colors.text} /></View>
        </Reveal>
        <Reveal shown={focused && chevrons.forward} style={[styles.chevron, styles.chevronRight]}>
          <View style={styles.chevronDisc}><Icon name="chevronRight" size={30} color={colors.text} /></View>
        </Reveal>
        <View style={styles.edge} />
      </Animated.View>
      {/* Pendant la bande-annonce : le titre seul, en haut à gauche. */}
      <Animated.View style={[styles.watchTitle, watchTitle]} pointerEvents="none">
        <TitleArt title={shown.title} logoUri={shown.logoUri} maxWidth={420} maxHeight={84} fontSize={42} />
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  shadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R,
    backgroundColor: colors.surface1,
    shadowColor: "#000",
    shadowOpacity: 0.7,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 24 },
    elevation: 18,
  },
  clip: { ...StyleSheet.absoluteFillObject, borderRadius: R, overflow: "hidden", backgroundColor: colors.surface1 },
  text: { position: "absolute", left: 64, bottom: 104, width: 820, gap: 14 },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
  reason: { ...fonts.semibold, fontSize: 25, color: white(0.92), flexShrink: 1 },
  title: { alignSelf: "flex-start" },
  foot: { position: "absolute", left: 64, right: 48, bottom: 36, flexDirection: "row", alignItems: "center" },
  hint: { ...fonts.medium, fontSize: 20, color: colors.textSecondary },
  dots: { marginLeft: "auto", flexDirection: "row", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: white(0.4) },
  dotOn: { width: 34, backgroundColor: colors.text },
  chevron: { position: "absolute", top: H / 2 - 28 },
  chevronLeft: { left: 18 },
  chevronRight: { right: 18 },
  chevronDisc: { width: 56, height: 56, borderRadius: 28, backgroundColor: ZONE_HINT_PILL.backgroundColor, alignItems: "center", justifyContent: "center" },
  edge: { ...StyleSheet.absoluteFillObject, borderRadius: R, borderWidth: 1, borderColor: white(0.12) },
  watchTitle: { position: "absolute", left: 40, top: 34 },
});
