import { memo, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { colors, fonts, scrim } from "../theme/tokens";
import { CardBadge } from "./CardBadge";
import { CardFrame } from "./CardFrame";
import { CardHoldHint } from "./CardHoldHint";
import { CardLiftLayer } from "./CardLiftLayer";
import { CardMarkerLayer } from "./CardMarkerLayer";
import type { CardModel } from "./cardTypes";
import { CardHoverVeil } from "./tray/CardHoverVeil";
import { CardTray } from "./tray/CardTray";
import { trayReach } from "./tray/trayLayout";
import { TRAY_REVEAL_MS, useCardHover } from "./tray/useCardHover";

/**
 * La carte d'un titre — deux formats, un seul modèle :
 * - `landscape` (16:9) : image Thumb/Backdrop, logo du titre posé dessus
 *   quand l'image n'en porte pas ; légende dessous ;
 * - `poster` (2:3) : l'affiche ; légende dessous.
 * Rien au centre de l'image : OK fait déjà l'action principale, l'appui long
 * ouvre la feuille.
 *
 * Au focus, la carte grandit et, quand l'intégration lui donne un plateau
 * (`card.tray`), montre le SURVOL du bureau : voile, note perso et capsule
 * d'actions (`tray/CardTray` — son en-tête dit le parcours à la télécommande
 * et les clés). La note globale du repos s'efface ; l'épingle des états et la
 * progression restent ; sur une vignette, le logo cède la place au plateau.
 * Une vignette qui s'ouvre par l'appui long (`onLongPress`) le dit sous sa
 * légende, au focus de la carte même : « Maintenir OK : plus d'options »
 * (`CardHoldHint`) — OK y lit, rien d'autre ne l'apprendrait.
 *
 * La carte et les boutons de son plateau sont des focalisables FRÈRES : tvOS
 * ne focalise jamais un élément posé dans un autre, ni un élément RECOUVERT
 * par ce qui dessine. D'où trois étages, de bas en haut : l'image
 * (`CardFrame`), le plateau (`CardLiftLayer`, qui épouse l'image agrandie),
 * puis la carte elle-même — un `FocusTarget` sans rendu, à sa place de repos,
 * qui s'arrête au-dessus des boutons du plateau quand il est ouvert
 * (`trayReach`). Rien ne recouvre un focalisable. `onFocusChange` dit
 * l'ouverture de la carte, focus du plateau compris (`useCardHover`).
 */

export interface MediaCardProps {
  card: CardModel;
  variant: "landscape" | "poster";
  /** Largeur ; la hauteur suit le format. */
  width?: number;
  dimmed?: boolean;
  focusKey?: string;
  origin?: "top" | "center";
  /** Cacher la légende (grilles denses, rangées d'épisodes qui portent la leur). */
  hideCaption?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const DEFAULT_WIDTH = { landscape: TV_STAGE.card.landscape.width, poster: TV_STAGE.card.poster.width };
const NO_VISUAL = () => null;

/** Ce que le pied de l'image descend quand elle grandit (et se soulève de 4) :
 *  la légende descend d'autant, l'image ne la recouvre jamais. */
function captionShift(height: number, origin: "top" | "center" = "top"): number {
  const growth = height * (TV_STAGE.focus.cardScale - 1);
  return origin === "center" ? growth / 2 : growth - 4;
}

function Caption({ focused, shift, children }: { focused: boolean; shift: number; children: ReactNode }) {
  const p = useFocusProgress(focused);
  const follow = useAnimatedStyle(() => ({ transform: [{ translateY: shift * p.value }] }));
  return <Animated.View style={[styles.caption, follow]}>{children}</Animated.View>;
}

/** Le logo d'une vignette et son dégradé : ils cèdent la place au plateau. */
function LogoLayer({ uri, hidden }: { uri: string; hidden: boolean }) {
  const p = useFocusProgress(hidden, TRAY_REVEAL_MS);
  const fade = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]}>
      <LinearGradient colors={[scrim(0), scrim(0.55)]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <Image source={{ uri }} style={styles.logo} resizeMode="contain" fadeDuration={0} />
    </Animated.View>
  );
}

export const MediaCard = memo(function MediaCard({
  card,
  variant,
  width = DEFAULT_WIDTH[variant],
  dimmed,
  focusKey,
  origin,
  hideCaption = false,
  onPress,
  onLongPress,
  onFocusChange,
}: MediaCardProps) {
  const landscape = variant === "landscape";
  const height = Math.round(landscape ? (width * 9) / 16 : width * 1.5);
  const radius = landscape ? TV_STAGE.card.landscape.radius : TV_STAGE.card.poster.radius;
  const uri = landscape ? card.landscapeUri ?? card.posterUri : card.posterUri ?? card.landscapeUri;
  const hover = useCardHover(focusKey, onFocusChange);
  const lift = useFocusProgress(hover.open);
  const tray = hover.mounted ? card.tray : undefined;
  const hovered = hover.open && card.tray !== undefined;
  const reach = hovered && card.tray ? trayReach(variant, width, card.tray.actions.length) : 0;
  // La carte elle-même a le focus (pas son plateau) : maintenir OK y ouvre la feuille.
  const holdHint = landscape && onLongPress !== undefined && hover.open && hover.trayFocus === null;
  return (
    <View style={[{ width }, hover.open && styles.front]}>
      <CardFrame width={width} height={height} radius={radius} focused={hover.open} dimmed={dimmed} origin={origin} progress={lift}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} />
        ) : (
          <View style={styles.missing}>
            <Text style={styles.missingTitle} numberOfLines={3}>{card.title}</Text>
          </View>
        )}
        {landscape && card.logoUri ? <LogoLayer uri={card.logoUri} hidden={hovered} /> : null}
        {tray ? <CardHoverVeil shown={hover.open} /> : null}
        {card.badge ? <CardBadge label={card.badge} /> : null}
        <CardMarkerLayer markers={card.markers} progress={card.progress} compact={!landscape} hovered={hovered} />
      </CardFrame>
      {tray ? (
        <CardLiftLayer width={width} height={height} origin={origin} progress={lift}>
          <CardTray
            tray={tray}
            face={variant}
            width={width}
            cardKey={focusKey}
            title={card.title}
            shown={hover.open}
            trayFocus={hover.trayFocus}
            onTrayFocusChange={hover.onTrayFocusChange}
          />
        </CardLiftLayer>
      ) : null}
      <FocusTarget
        focusKey={focusKey}
        onPress={onPress}
        onLongPress={onLongPress}
        onFocusChange={hover.onCardFocusChange}
        accessibilityLabel={card.title}
        style={[styles.hit, { width, height: height - reach }]}
      >
        {NO_VISUAL}
      </FocusTarget>
      {hideCaption ? null : (
        <Caption focused={hover.open} shift={captionShift(height, origin)}>
          <Text style={[styles.title, hover.open && styles.titleFocused]} numberOfLines={1}>{card.title}</Text>
          {card.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text> : null}
          {holdHint ? <CardHoldHint /> : null}
        </Caption>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  // La carte ouverte passe devant ses voisines : son ombre de soulèvement
  // n'est plus recouverte par la suivante.
  front: { zIndex: 10 },
  hit: { position: "absolute", top: 0, left: 0 },
  missing: { flex: 1, padding: 22, justifyContent: "flex-end", backgroundColor: colors.surface3 },
  missingTitle: { ...fonts.bold, fontSize: 26, lineHeight: 30, color: colors.textSecondary },
  logo: { position: "absolute", left: 22, right: 90, bottom: 22, height: 64 },
  caption: { marginTop: 14, gap: 2 },
  title: { ...fonts.semibold, fontSize: 24, color: colors.textSecondary },
  titleFocused: { color: colors.text },
  subtitle: { ...fonts.medium, fontSize: 22, color: colors.textTertiary },
});
