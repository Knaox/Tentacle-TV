import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { OpenCardMetrics } from "@tentacle-tv/tv-core";
import { SoftGradient } from "../background/SoftGradient";
import { CardMarkerLayer } from "../cards/CardMarkerLayer";
import { CardQualityBadges } from "../cards/CardQualityBadges";
import type { CardModel } from "../cards/cardTypes";
import { useStageShown } from "../cards/trailerPreviewPort";
import { colors, fonts, scrim, white } from "../theme/tokens";

/**
 * La FACE OUVERTE d'une carte (tv-core `cards/openCard.ts`) : la vignette 16:9
 * du titre, à la hauteur de l'affiche — son fond, son logo (ou son titre
 * écrit), ses marqueurs, sa qualité quand le focus a tenu ; un titre absent,
 * son badge. Le focus se dit par l'OMBRE seule (choix de Damien au banc du
 * 19/10) : aucun liseré.
 *
 * Dessinée SOUS la cible de la carte (`CardShell` : la légende et elle avant
 * la cible) — rien ne recouvre une cible. `open` (0 → 1) la fait entrer en
 * fondu pendant que les voisines glissent ; `watch` (0 → 1) l'efface quand la
 * bande-annonce se montre : la vidéo, posée DERRIÈRE la page au même endroit
 * (`PreviewStage`), se voit à travers. Pendant la vidéo, le TITRE reste, en
 * petit, en haut à gauche — jamais au milieu de l'image : on sait ce qu'on
 * regarde (demande de Damien du 19/10, comme la bannière).
 */
export const OpenVisual = memo(function OpenVisual({ card, metrics, open, watch, focused }: {
  card: CardModel;
  metrics: OpenCardMetrics;
  open: SharedValue<number>;
  watch: SharedValue<number>;
  focused: boolean;
}) {
  const { openWidth: width, height, openRadius: radius } = metrics;
  // La face ne s'efface que là où la scène montre sa vidéo : la scène coupée, elle revient à la même image.
  const stage = useStageShown(1);
  const face = useAnimatedStyle(() => ({ opacity: open.value * (1 - watch.value * stage.value) }));
  const shadow = useAnimatedStyle(() => ({ opacity: open.value * (1 - watch.value * stage.value) }));
  const watchTitle = useAnimatedStyle(() => ({ opacity: open.value * watch.value * stage.value }));
  const uri = card.billboard?.backdropUri ?? card.landscapeUri ?? card.posterUri;
  const logo = card.billboard?.logoUri ?? card.logoUri;
  return (
    <View pointerEvents="none" style={[styles.anchor, { width, height }]}>
      {/* L'ombre : un calque plein sous l'image — la carte se soulève, sans liseré. */}
      <Animated.View style={[styles.shadow, { borderRadius: radius }, shadow]} />
      <Animated.View style={[styles.face, { borderRadius: radius }, face]}>
        {uri ? <Image key={uri} source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
        <SoftGradient width={width} height={height} colors={[scrim(0), scrim(0.62)]} locations={[0.45, 1]} />
        <View style={[styles.title, { maxWidth: Math.round(width * 0.5) }]}>
          {logo ? (
            <Image source={{ uri: logo }} style={[styles.logo, { width: Math.round(width * 0.42), height: Math.round(height * 0.2) }]} resizeMode="contain" fadeDuration={0} />
          ) : (
            <Text style={styles.titleText} numberOfLines={2}>{card.title}</Text>
          )}
        </View>
        {card.absent ? (
          <View style={styles.absent}>
            <Text style={styles.absentText} numberOfLines={1}>{card.absent.label}</Text>
          </View>
        ) : (
          <CardMarkerLayer markers={card.markers} progress={card.progress} />
        )}
        {card.quality && !card.absent ? (
          <CardQualityBadges quality={card.quality} focused={focused} width={width} markers={card.markers} progress={card.progress} compact={false} logo={false} />
        ) : null}
        <View style={[styles.edge, { borderRadius: radius }]} />
      </Animated.View>
      {/* Pendant la bande-annonce : le titre, en petit, en haut à gauche. */}
      <Animated.View style={[styles.watch, { width, height, borderRadius: radius }, watchTitle]}>
        <SoftGradient width={width} height={height} colors={[scrim(0.55), scrim(0)]} locations={[0, 0.3]} />
        <View style={[styles.watchTitle, { maxWidth: Math.round(width * 0.4) }]}>
          {logo ? (
            <Image source={{ uri: logo }} style={[styles.logo, { width: Math.round(width * 0.26), height: Math.round(height * 0.12) }]} resizeMode="contain" fadeDuration={0} />
          ) : (
            <Text style={styles.watchTitleText} numberOfLines={1}>{card.title}</Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  anchor: { position: "absolute", left: 0, top: 0 },
  shadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface1,
    shadowColor: "#000",
    shadowOpacity: 0.7,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 22 },
    elevation: 18,
  },
  face: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: colors.surface1 },
  title: { position: "absolute", left: 28, bottom: 68 },
  logo: { alignSelf: "flex-start" },
  titleText: { ...fonts.extrabold, fontSize: 46, lineHeight: 48, color: colors.text, letterSpacing: -0.5 },
  absent: { position: "absolute", left: 14, bottom: 14, paddingHorizontal: 12, minHeight: 34, borderRadius: 14, backgroundColor: scrim(0.72), justifyContent: "center" },
  absentText: { ...fonts.bold, fontSize: 21, color: white(0.92) },
  edge: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: white(0.12) },
  watch: { position: "absolute", left: 0, top: 0, overflow: "hidden" },
  watchTitle: { position: "absolute", left: 24, top: 20 },
  watchTitleText: { ...fonts.extrabold, fontSize: 28, lineHeight: 32, color: colors.text, letterSpacing: -0.3 },
});
