import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { PillButton } from "../../controls/PillButton";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { colors, scrim, text } from "../../theme/tokens";
import { useAppear } from "./useAppear";

/**
 * La grande liste en surimpression d'un filtre : un voile sur tout l'écran,
 * et au centre un panneau de verre — son titre, une ligne d'aide, le contenu
 * (cases, choix, bornes, paliers), puis « Effacer » et la pilule blanche
 * « Voir N titres » qui referme. Menu (Retour) referme aussi : c'est
 * l'intégration qui l'écoute.
 *
 * Clés de focus : `sheet:clear`, `sheet:apply` (le contenu pose les siennes).
 */

export interface FilterSheetProps {
  title: string;
  subtitle?: string;
  /** Largeur du panneau ; la hauteur suit le contenu. */
  width: number;
  applyLabel: string;
  clearLabel?: string;
  onApply?: () => void;
  onClear?: () => void;
  children: ReactNode;
}

export const FilterSheet = memo(function FilterSheet({
  title,
  subtitle,
  width,
  applyLabel,
  clearLabel,
  onApply,
  onClear,
  children,
}: FilterSheetProps) {
  const p = useAppear();
  const veil = useAnimatedStyle(() => ({ opacity: p.value }));
  const panel = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: 28 * (1 - p.value) }] }));
  const backing = useNativeGlassBacking("strong");
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, veil]} pointerEvents="none">
        <LinearGradient
          colors={[scrim(0.86), scrim(0.74), scrim(0.86)]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View style={[{ width }, panel]}>
          {/* Le verre dessiné laisserait voir la grille à travers la liste (il
              ne floute rien) : un fond fumé presque opaque le porte. Le verre
              natif floute : il prend le fond commun. */}
          <View style={[styles.backing, backing]} />
          <GlassSurface radius={TV_STAGE.radius.sheet} tone="strong" elevated style={styles.panel}>
            <View style={styles.header}>
              <Text style={text.heading} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={[text.meta, styles.subtitle]} numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {children}
            <View style={styles.footer}>
              {clearLabel ? (
                <PillButton variant="glass" size="md" icon="close" label={clearLabel} focusKey="sheet:clear" onPress={onClear} />
              ) : (
                <View />
              )}
              <PillButton variant="primary" size="md" icon="check" label={applyLabel} focusKey="sheet:apply" onPress={onApply} />
            </View>
          </GlassSurface>
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  backing: { ...StyleSheet.absoluteFillObject, borderRadius: TV_STAGE.radius.sheet, backgroundColor: scrim(0.9) },
  panel: { paddingHorizontal: 48, paddingTop: 42, paddingBottom: 40, gap: 30 },
  header: { gap: 8 },
  subtitle: { color: colors.textTertiary },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
});
