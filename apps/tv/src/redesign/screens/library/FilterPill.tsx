import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import type { FilterPillModel } from "./libraryTypes";

/**
 * Une pastille de la barre de filtres : le NOM du critère en petit, sa VALEUR
 * courante dessous — « Genres / Tous », « Trier par / Titre A→Z » —, et le
 * chevron d'une liste qui s'ouvre. Deux lignes plutôt qu'une : sept critères
 * tiennent ainsi sur une seule rangée, sans rien couper.
 *
 * - repos : verre ; valeur par défaut en blanc adouci ;
 * - réglée (`active`) : fond blanc translucide, valeur en blanc plein ;
 * - focus : blanche, texte noir, légèrement agrandie et soulevée.
 * Une bascule (Favoris) n'a qu'une ligne : son pictogramme et son nom.
 */

export interface FilterPillProps {
  pill: FilterPillModel;
  focusKey?: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

export const PILL_HEIGHT = 76;
const RADIUS = PILL_HEIGHT / 2;

export const FilterPill = memo(function FilterPill({ pill, focusKey, onPress, onFocusChange }: FilterPillProps) {
  const spoken = pill.value ? `${pill.label}, ${pill.value}` : pill.label;
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} onFocusChange={onFocusChange} accessibilityLabel={spoken}>
      {(focused) => <Body pill={pill} focused={focused} />}
    </FocusTarget>
  );
});

function Content({ pill, inverted }: { pill: FilterPillModel; inverted: boolean }) {
  const strong = inverted ? colors.ctaFg : colors.text;
  if (pill.toggle) {
    const icon = pill.active && pill.activeIcon ? pill.activeIcon : pill.icon;
    const iconColor = pill.active && !inverted ? colors.accentLight : pill.active ? colors.accentDeep : strong;
    return (
      <View style={styles.row}>
        {icon ? <Icon name={icon} size={28} color={iconColor} strokeWidth={2.2} /> : null}
        <Text style={[styles.toggleLabel, { color: strong }]} numberOfLines={1}>{pill.label}</Text>
      </View>
    );
  }
  const caption = inverted ? scrim(0.56) : colors.textTertiary;
  const value = inverted ? colors.ctaFg : pill.active ? colors.text : white(0.84);
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text style={[styles.caption, { color: caption }]} numberOfLines={1}>{pill.label}</Text>
        <Text style={[pill.active ? styles.valueStrong : styles.value, { color: value }]} numberOfLines={1}>{pill.value}</Text>
      </View>
      <Icon name="chevronDown" size={20} color={inverted ? colors.ctaFg : white(0.7)} strokeWidth={2.6} />
    </View>
  );
}

function Body({ pill, focused }: { pill: FilterPillModel; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * p.value }, { scale: 1 + 0.05 * p.value }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={lift}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, whiteLayer]} />
      {pill.active ? (
        <View style={[StyleSheet.absoluteFill, styles.activeFill]} />
      ) : (
        <GlassSurface radius={RADIUS} tone="clear" style={StyleSheet.absoluteFill} />
      )}
      <Content pill={pill} inverted={false} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, whiteLayer]}>
        <Content pill={pill} inverted />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Marges serrées : sept pastilles tiennent sur la colonne de contenu (1 648 pt)
  // même avec de longues valeurs — une rangée qui passe à la ligne se lit mal.
  row: { height: PILL_HEIGHT, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 24, paddingRight: 18 },
  texts: { justifyContent: "center", maxWidth: 230 },
  caption: { ...fonts.medium, fontSize: 22, lineHeight: 26 },
  value: { ...fonts.semibold, fontSize: 26, lineHeight: 31 },
  valueStrong: { ...fonts.bold, fontSize: 26, lineHeight: 31 },
  toggleLabel: { ...fonts.bold, fontSize: 26, paddingLeft: 2, paddingRight: 6 },
  activeFill: { borderRadius: RADIUS, backgroundColor: white(0.22), borderWidth: 1, borderColor: white(0.26) },
  focusFill: { borderRadius: RADIUS, backgroundColor: colors.ctaBg },
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
});
