/**
 * Octave (mobile) — le bouton d'ACTION PRINCIPALE du mode (« Lecture », et
 * l'unique appel d'une feuille : Créer, Enregistrer…) : une pilule au fond de
 * marque (`OctaveBrandFill`), glyphe et libellé blancs, 48 pt de haut, un léger
 * enfoncement à l'appui. `round` : le rond sans libellé (lecture d'une carte),
 * qui garde son nom pour les lecteurs d'écran.
 */

import { memo } from "react";
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { Play, type LucideIcon } from "lucide-react-native";
import { typography } from "@/theme";
import { useOctaveColors } from "../theme/octaveColors";
import { OctaveBrandFill } from "./OctaveBrandFill";
import { PressableScale } from "./PressableScale";

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Une attente : le glyphe tourne, le bouton ne répond plus. */
  busy?: boolean;
  /** Le glyphe (Lecture par défaut) ; `null` : le libellé seul. */
  Icon?: LucideIcon | null;
  /** Le rond sans libellé, de ce diamètre. */
  round?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const OctavePlayButton = memo(function OctavePlayButton({ label, onPress, disabled, busy, Icon = Play, round, accessibilityLabel, style }: Props) {
  const colors = useOctaveColors();
  const fg = colors.onBrandFill;
  const radius = round ? round / 2 : 24;
  const glyph = round ? Math.round(round * 0.42) : 18;
  const filled = Icon === Play;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      pressedScale={round ? 0.94 : 0.97}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      hitSlop={round && round < 44 ? (44 - round) / 2 : undefined}
      style={[round ? { width: round, height: round, borderRadius: radius } : styles.pill, styles.center, { opacity: disabled ? 0.45 : 1 }, style]}
    >
      <OctaveBrandFill radius={radius} />
      {busy ? <ActivityIndicator size="small" color={fg} /> : Icon ? <Icon size={glyph} color={fg} fill={filled ? fg : "transparent"} style={filled && round ? styles.nudge : undefined} /> : null}
      {round ? null : <Text style={[typography.bodyBold, { color: fg }]} numberOfLines={1}>{label}</Text>}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  pill: { minHeight: 48, paddingHorizontal: 26, borderRadius: 24, gap: 8, flexDirection: "row" },
  center: { alignItems: "center", justifyContent: "center" },
  // Le triangle de lecture paraît décentré à gauche : un point vers la droite.
  nudge: { marginLeft: 2 },
});
