import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { GlassSurface } from "../glass/GlassSurface";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, white } from "../theme/tokens";

/**
 * La pastille : filtres, genres, saisons, choix d'un réglage.
 *
 * - repos : verre, texte blanc ;
 * - `selected` : blanc translucide appuyé, texte gras — ce qui est retenu ;
 * - focus : blanche, texte noir, légèrement agrandie.
 * `detail` : une valeur à droite (« 3 », « 2019–2024 »). `trailingIcon` :
 * la croix d'un filtre actif, le chevron d'une liste.
 */

export interface ChipProps {
  label: string;
  detail?: string;
  icon?: IconName;
  trailingIcon?: IconName;
  selected?: boolean;
  size?: "lg" | "md";
  focusKey?: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const HEIGHT = { lg: 60, md: 52 } as const;

export const Chip = memo(function Chip(props: ChipProps) {
  return (
    <FocusTarget focusKey={props.focusKey} onPress={props.onPress} onFocusChange={props.onFocusChange} accessibilityLabel={props.label}>
      {(focused) => <ChipBody {...props} focused={focused} />}
    </FocusTarget>
  );
});

function Row({ label, detail, icon, trailingIcon, color, detailColor, height, bold }: {
  label: string;
  detail?: string;
  icon?: IconName;
  trailingIcon?: IconName;
  color: string;
  detailColor: string;
  height: number;
  bold: boolean;
}) {
  return (
    <View style={[styles.row, { height, paddingHorizontal: height * 0.44 }]}>
      {icon ? <Icon name={icon} size={24} color={color} /> : null}
      <Text style={[bold ? styles.labelBold : styles.label, { color }]} numberOfLines={1}>{label}</Text>
      {detail ? <Text style={[styles.detail, { color: detailColor }]} numberOfLines={1}>{detail}</Text> : null}
      {trailingIcon ? <Icon name={trailingIcon} size={22} color={color} strokeWidth={2.4} /> : null}
    </View>
  );
}

function ChipBody({ label, detail, icon, trailingIcon, selected = false, size = "lg", focused }: ChipProps & { focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.05 * p.value }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const height = HEIGHT[size];
  const radius = height / 2;
  return (
    <Animated.View style={lift}>
      {selected ? (
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: white(0.26) }]} />
      ) : (
        <GlassSurface radius={radius} tone="clear" style={StyleSheet.absoluteFill} />
      )}
      <Row label={label} detail={detail} icon={icon} trailingIcon={trailingIcon} color={colors.text} detailColor={colors.textSecondary} height={height} bold={selected} />
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: colors.ctaBg }, whiteLayer]}>
        <Row label={label} detail={detail} icon={icon} trailingIcon={trailingIcon} color={colors.ctaFg} detailColor="rgba(0, 0, 0, 0.6)" height={height} bold={selected} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: { ...fonts.semibold, fontSize: 24 },
  labelBold: { ...fonts.bold, fontSize: 24 },
  detail: { ...fonts.medium, fontSize: 22 },
});
