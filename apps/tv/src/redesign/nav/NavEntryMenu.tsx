import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { GlassSurface } from "../glass/GlassSurface";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, white } from "../theme/tokens";

/**
 * Le menu d'une entrée de la navigation, ouvert par l'appui long : posé à
 * droite du rail ouvert, où l'entrée concernée porte le liseré de la marque.
 * En tête, son nom et sa place (« 4 sur 24 ») ; dessous, ce qu'on peut en
 * faire — Déplacer, Monter, Descendre, Masquer, Tout afficher, Réglages de
 * la navigation. Une action impossible (Monter, déjà en tête) reste à sa
 * place, estompée : le focus ne saute pas quand elle le devient.
 *
 * Aucune décision de focus : l'intégration le pose dans une Modal (le focus
 * n'en sort pas, Retour la referme) et garde ses actions du clic fantôme
 * (le menu s'ouvre sous un OK encore enfoncé).
 *
 * Clés de focus : `nav:menu:<action>` — une clé de la navigation : le rail
 * reste ouvert derrière.
 */

export interface NavMenuItem {
  key: string;
  label: string;
  icon: IconName;
  disabled?: boolean;
}

export interface NavEntryMenuProps {
  title: string;
  caption?: string;
  items: NavMenuItem[];
  onPress?: (key: string) => void;
}

const N = TV_STAGE.nav;
const WIDTH = 560;
const RADIUS = 36;
const ROW = 76;

export const NavEntryMenu = memo(function NavEntryMenu({ title, caption, items, onPress }: NavEntryMenuProps) {
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.layer} pointerEvents="box-none">
      <View style={styles.panel}>
        <View style={[StyleSheet.absoluteFill, styles.base]} />
        <GlassSurface radius={RADIUS} tone="strong" style={StyleSheet.absoluteFill} elevated />
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        </View>
        <View style={styles.divider} />
        <View style={styles.rows}>
          {items.map((item) => (
            <FocusTarget
              key={item.key}
              focusKey={`nav:menu:${item.key}`}
              onPress={onPress && !item.disabled ? () => onPress(item.key) : undefined}
              disabled={item.disabled}
              accessibilityLabel={item.label}
            >
              {(focused) => <Row item={item} focused={focused} />}
            </FocusTarget>
          ))}
        </View>
      </View>
    </Animated.View>
  );
});

function Line({ item, dark }: { item: NavMenuItem; dark: boolean }) {
  const color = dark ? colors.ctaFg : colors.text;
  return (
    <View style={styles.row}>
      <Icon name={item.icon} size={30} color={color} strokeWidth={2.2} />
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {item.label}
      </Text>
    </View>
  );
}

function Row({ item, focused }: { item: NavMenuItem; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.03 * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.rowBox, item.disabled && styles.disabled, lift]}>
      <Line item={item} dark={false} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, onLayer]}>
        <Line item={item} dark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, justifyContent: "center" },
  panel: { marginLeft: N.left + N.expandedWidth + 28, width: WIDTH, borderRadius: RADIUS, paddingBottom: 18 },
  base: { borderRadius: RADIUS, backgroundColor: "rgba(10, 10, 14, 0.94)" },
  header: { paddingHorizontal: 40, paddingTop: 34, paddingBottom: 22, gap: 4 },
  title: { ...fonts.bold, fontSize: 36, lineHeight: 44, letterSpacing: -0.3, color: colors.text },
  caption: { ...fonts.medium, fontSize: 22, lineHeight: 30, color: colors.textTertiary },
  divider: { height: 1, marginHorizontal: 40, backgroundColor: white(0.1) },
  rows: { paddingHorizontal: 22, paddingTop: 14, gap: 6 },
  rowBox: { height: ROW, borderRadius: 22 },
  row: { height: ROW, flexDirection: "row", alignItems: "center", gap: 22, paddingHorizontal: 22 },
  label: { ...fonts.semibold, fontSize: 28, flexShrink: 1 },
  disabled: { opacity: 0.38 },
  focusFill: { borderRadius: 22, backgroundColor: colors.ctaBg },
});
