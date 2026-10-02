import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { pressScale, usePressProgress } from "../motion/pressProgress";
import { NativeDesaturate } from "../cards/nativeDesaturate";
import { GlassSurface } from "../glass/GlassSurface";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, white } from "../theme/tokens";

/**
 * La pastille : filtres, genres, saisons, choix d'un réglage.
 *
 * - repos : verre, texte blanc ;
 * - `selected` : blanc translucide appuyé, texte gras — ce qui est retenu ;
 * - focus : blanche, texte noir, légèrement agrandie ;
 * - `absent` : ce qui n'est PAS là (une saison à demander, au bout des onglets
 *   de la fiche) — le verre passe au gris du GPU, celui des titres absents
 *   (`NativeDesaturate`), cerclé de pointillés, le texte en retrait ; au
 *   focus, un gris clair et un texte noir : elle reste grise, focalisée.
 * `detail` : une valeur à droite (« 3 », « 2019–2024 »). `trailingIcon` :
 * la croix d'un filtre actif, le chevron d'une liste.
 */

export interface ChipProps {
  label: string;
  detail?: string;
  icon?: IconName;
  trailingIcon?: IconName;
  selected?: boolean;
  absent?: boolean;
  size?: "lg" | "md";
  focusKey?: string;
  /** Ce que dit un lecteur d'écran, quand le libellé n'y suffit pas (son état). */
  accessibilityLabel?: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const HEIGHT = { lg: 60, md: 52 } as const;
/** Une pastille absente : son texte en retrait au repos, son gris clair au focus. */
const ABSENT_TEXT = white(0.6);
const ABSENT_FOCUS = white(0.74);

export const Chip = memo(function Chip(props: ChipProps) {
  return (
    <FocusTarget focusKey={props.focusKey} onPress={props.onPress} onFocusChange={props.onFocusChange} accessibilityLabel={props.accessibilityLabel ?? props.label}>
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

function ChipBody({ label, detail, icon, trailingIcon, selected = false, absent = false, size = "lg", focused }: ChipProps & { focused: boolean }) {
  const p = useFocusProgress(focused);
  const press = usePressProgress();
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: (1 + 0.05 * p.value) * pressScale(press ? press.value : 0) }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const height = HEIGHT[size];
  const radius = height / 2;
  return (
    <Animated.View style={lift}>
      {selected && !absent ? (
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: white(0.26) }]} />
      ) : (
        <GlassSurface radius={radius} tone="clear" style={StyleSheet.absoluteFill} />
      )}
      {absent ? (
        <>
          {/* Le gris composé par le GPU, sur le verre et ce qu'il laisse voir. */}
          {NativeDesaturate ? <NativeDesaturate pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} /> : null}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.absentRing, { borderRadius: radius }]} />
        </>
      ) : null}
      <Row
        label={label}
        detail={detail}
        icon={icon}
        trailingIcon={trailingIcon}
        color={absent ? ABSENT_TEXT : colors.text}
        detailColor={absent ? ABSENT_TEXT : colors.textSecondary}
        height={height}
        bold={selected}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: absent ? ABSENT_FOCUS : colors.ctaBg }, whiteLayer]}>
        <Row label={label} detail={detail} icon={icon} trailingIcon={trailingIcon} color={colors.ctaFg} detailColor="rgba(0, 0, 0, 0.6)" height={height} bold={selected} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  absentRing: { borderWidth: 2, borderStyle: "dashed", borderColor: white(0.3) },
  label: { ...fonts.semibold, fontSize: 24 },
  labelBold: { ...fonts.bold, fontSize: 24 },
  detail: { ...fonts.medium, fontSize: 22 },
});
