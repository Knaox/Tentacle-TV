import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { useFocusProgress } from "../focus/useFocusProgress";
import { GlassSurface } from "../glass/GlassSurface";
import { useNativeGlassBacking } from "../glass/glassBacking";
import type { IconName } from "../icons/Icon";
import { colors, fonts, scrim, white } from "../theme/tokens";
import { NavItem } from "./NavItem";

/**
 * La navigation : une barre de verre qui flotte à gauche, décollée des bords.
 * Repliée, elle ne montre que les pictogrammes ; ouverte (elle a le focus),
 * elle s'élargit PAR-DESSUS le contenu, sous un voile, avec ses libellés.
 *
 * Toutes les entrées de l'app y sont : Rechercher, Accueil, Pour vous, Ma
 * liste, Favoris, chaque bibliothèque, « Tout afficher » (quand une entrée
 * est masquée) — et, en bas, le compte et ses réglages. L'appui long masque
 * une entrée masquable : l'intégration décide, la vue le rend possible.
 */

export interface NavEntry {
  key: string;
  label: string;
  icon: IconName;
}

export interface NavRailProps {
  /** Rechercher : à part, en tête, séparé du reste. */
  search: NavEntry;
  entries: NavEntry[];
  /** L'entrée du bas : le compte (portrait) et les réglages. */
  account: { key: string; label: string; avatarUri?: string; initial?: string };
  activeKey: string;
  expanded: boolean;
  /** L'aide de l'appui long, affichée barre ouverte. */
  hint?: string;
  onSelect?: (key: string) => void;
  onLongPress?: (key: string) => void;
  onFocusChange?: (key: string, focused: boolean) => void;
}

const N = TV_STAGE.nav;
const HEIGHT = 1080 - N.top - N.bottom;

export const NavRail = memo(function NavRail({
  search,
  entries,
  account,
  activeKey,
  expanded,
  hint,
  onSelect,
  onLongPress,
  onFocusChange,
}: NavRailProps) {
  const openness = useFocusProgress(expanded, 240);
  const wide = useAnimatedStyle(() => ({ opacity: openness.value }));
  const narrow = useAnimatedStyle(() => ({ opacity: 1 - openness.value }));
  const openBacking = useNativeGlassBacking("strong");
  const item = (entry: { key: string; label: string; icon?: IconName; avatarUri?: string; initial?: string }) => (
    <NavItem
      key={entry.key}
      itemKey={entry.key}
      label={entry.label}
      icon={entry.icon}
      avatarUri={entry.avatarUri}
      initial={entry.initial}
      active={entry.key === activeKey}
      expanded={expanded}
      openness={openness}
      onPress={onSelect ? () => onSelect(entry.key) : undefined}
      onLongPress={onLongPress ? () => onLongPress(entry.key) : undefined}
      onFocusChange={onFocusChange ? (focused) => onFocusChange(entry.key, focused) : undefined}
    />
  );
  return (
    <>
      {/* Une vue plein écran posée sur le contenu — la couche de la barre
          comme ce voile, même transparents — empêche le moteur de focus de
          tvOS d'y entrer (mesuré au simulateur). Le voile n'existe donc que
          barre ouverte ; l'intégration mène alors du rail au contenu. */}
      {expanded ? (
        <Animated.View pointerEvents="none" entering={FadeIn.duration(240)} exiting={FadeOut.duration(240)} style={styles.veil}>
          <LinearGradient
            colors={[scrim(0.82), scrim(0.55), scrim(0)]}
            locations={[0, 0.3, 0.62]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <View pointerEvents="box-none" style={[styles.layer, { width: N.left + (expanded ? N.expandedWidth : N.collapsedWidth) }]}>
        <View style={[styles.rail, { width: expanded ? N.expandedWidth : N.collapsedWidth }]}>
          <Animated.View style={[StyleSheet.absoluteFill, narrow]}>
            <GlassSurface radius={N.radius} style={[styles.glass, { width: N.collapsedWidth }]} elevated />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, wide]}>
            {/* Ouverte, la barre passe SUR le texte de l'écran : le verre
                dessiné ne floute rien, un fond dense garde les libellés
                lisibles. Le verre natif floute : il prend le fond commun. */}
            <View style={[styles.glass, styles.openBase, openBacking, { width: N.expandedWidth }]} />
            <GlassSurface radius={N.radius} tone="strong" style={[styles.glass, { width: N.expandedWidth }]} elevated />
          </Animated.View>
          <View style={styles.items}>
            {item(search)}
            <View style={[styles.separator, { width: expanded ? N.expandedWidth - 60 : 44 }]} />
            {entries.map(item)}
            <View style={styles.spacer} />
            {expanded && hint ? (
              <Animated.View style={wide}>
                <Text style={styles.hint}>{hint}</Text>
              </Animated.View>
            ) : null}
            {item(account)}
          </View>
        </View>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  // La région de la barre seulement (voir le voile, plus haut).
  layer: { position: "absolute", left: 0, top: 0, height: 1080 },
  veil: { position: "absolute", left: 0, top: 0, width: 1920, height: 1080 },
  rail: { position: "absolute", left: N.left, top: N.top, height: HEIGHT },
  glass: { position: "absolute", left: 0, top: 0, height: HEIGHT },
  openBase: { borderRadius: N.radius, backgroundColor: "rgba(10, 10, 14, 0.84)" },
  items: { flex: 1, paddingVertical: 22, paddingHorizontal: 16, gap: 8, alignItems: "flex-start", paddingLeft: 20 },
  separator: { height: 1, marginVertical: 8, marginLeft: 10, backgroundColor: white(0.12) },
  spacer: { flex: 1 },
  hint: { ...fonts.medium, fontSize: 22, lineHeight: 30, color: colors.textTertiary, width: N.expandedWidth - 56, marginBottom: 12, marginLeft: 6 },
});
