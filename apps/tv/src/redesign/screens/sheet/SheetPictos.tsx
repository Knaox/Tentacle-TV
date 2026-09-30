import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { BrandPill } from "../../brand/BrandPill";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { colors, fonts, white } from "../../theme/tokens";
import { SheetGlyph } from "./SheetGlyph";
import type { SheetActionKind, SheetActionModel } from "./sheetTypes";

/**
 * Les pictos du grand panneau, sous la note, dans l'ordre du modèle partagé :
 * la lecture (ou « Demander ») en tête, Ma liste → favori → vu (l'ordre de
 * l'épingle des cartes), puis les extras. Chacun dit son geste en toutes
 * lettres sous son rond — un rond seul ne dit pas ce qu'il fait, à trois
 * mètres.
 *
 * - La lecture et « Demander » portent la MARQUE : le dégradé violet → rose,
 *   qui s'allume au focus (`BrandPill`) ;
 * - une bascule POSÉE prend un voile blanc et son glyphe se remplit (le cœur
 *   au rose de la marque) ;
 * - au focus, le rond devient BLANC, glyphe noir, et grandit : pas d'anneau.
 *
 * Focus (câblage) : groupe `sheet:actions`, pictos `sheet:action:<kind>`.
 */

const SIZE = 84;
const GLYPH = 34;
const LABEL_WIDTH = 140;

export const SheetPictos = memo(function SheetPictos({
  actions,
  onAction,
}: {
  actions: SheetActionModel[];
  onAction?: (kind: SheetActionKind) => void;
}) {
  return (
    <FocusGroup focusKey="sheet:actions" style={styles.row}>
      {actions.map((action) => (
        <SheetPicto
          key={action.kind}
          action={action}
          focusKey={`sheet:action:${action.kind}`}
          onPress={onAction ? () => onAction(action.kind) : undefined}
        />
      ))}
    </FocusGroup>
  );
});

const SheetPicto = memo(function SheetPicto({
  action,
  focusKey,
  onPress,
}: {
  action: SheetActionModel;
  focusKey: string;
  onPress?: () => void;
}) {
  return (
    <FocusTarget
      focusKey={focusKey}
      onPress={onPress}
      accessibilityLabel={action.detail ? `${action.label}, ${action.detail}` : action.label}
    >
      {(focused) => <Picto action={action} focused={focused} />}
    </FocusTarget>
  );
});

function Picto({ action, focused }: { action: SheetActionModel; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.12 * p.value }] }));
  const light = useAnimatedStyle(() => ({ opacity: p.value }));
  const brand = action.kind === "play" || action.kind === "request";
  const heart = action.kind === "favorite" && action.active === true;
  return (
    <View style={styles.cell}>
      <Animated.View style={[styles.round, lift]}>
        {brand ? (
          <BrandPill progress={p} radius={SIZE / 2}>
            <View style={styles.face}>
              <SheetGlyph kind={action.kind} color={colors.onAccent} size={GLYPH} />
            </View>
          </BrandPill>
        ) : (
          <>
            <View style={[StyleSheet.absoluteFill, styles.idle, action.active && styles.active]} />
            <View style={styles.face}>
              <SheetGlyph kind={action.kind} active={action.active} color={heart ? colors.accentLight : colors.text} size={GLYPH} />
            </View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.face, styles.lit, light]}>
              <SheetGlyph kind={action.kind} active={action.active} color={heart ? colors.accentDeep : colors.ctaFg} size={GLYPH} />
            </Animated.View>
          </>
        )}
      </Animated.View>
      <Text style={[styles.label, focused && styles.labelFocused]} numberOfLines={2}>{action.label}</Text>
      {action.detail ? <Text style={styles.detail} numberOfLines={1}>{action.detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 14 },
  cell: { width: LABEL_WIDTH, alignItems: "center", gap: 14 },
  round: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  face: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  idle: { borderRadius: SIZE / 2, backgroundColor: white(0.1), borderWidth: 1, borderColor: white(0.14) },
  active: { backgroundColor: white(0.2) },
  lit: { borderRadius: SIZE / 2, backgroundColor: colors.ctaBg },
  label: { ...fonts.semibold, fontSize: 22, lineHeight: 27, color: colors.textSecondary, textAlign: "center" },
  labelFocused: { ...fonts.bold, color: colors.text },
  detail: { ...fonts.medium, fontSize: 20, color: colors.textTertiary, fontVariant: ["tabular-nums"], marginTop: -8 },
});
