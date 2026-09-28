import { memo, useCallback, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { BRAND } from "@tentacle-tv/shared";
import { Focusable } from "../../focus/Focusable";
import { Colors, Fonts, Radius } from "../../../theme/colors";

/** La hauteur d'une action : la cible d'un téléviseur, lisible à trois mètres. */
export const SHEET_BUTTON_HEIGHT = 60;
const RADIUS = Radius.button;

interface TVCardSheetButtonProps {
  icon: ReactNode;
  label: string;
  /** Le complément, aligné à droite : l'épisode résolu, la position de reprise. */
  detail?: string | null;
  /** L'action principale — Lire / Reprendre, sur le dégradé de marque. */
  primary?: boolean;
  /** Le focus s'y pose à l'ouverture de la feuille. */
  preferred?: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * Une action de la feuille : glyphe, libellé qui dit le geste, complément.
 *
 * Le focus se lit de trois façons, pour qu'aucune ne manque à trois mètres :
 * l'anneau blanc des boutons, un léger agrandissement, et le fond qui
 * s'éclaircit. Sur l'action principale, le dégradé est opaque et couvrirait
 * l'anneau que `Focusable` peint SOUS son enfant : elle le repeint par-dessus,
 * avec le halo de marque en plus.
 *
 * `phantomPressGuard` : la feuille s'ouvre sous un OK encore enfoncé (l'appui
 * long), et son relâchement ne doit pas valider la première action.
 */
export const TVCardSheetButton = memo(function TVCardSheetButton({
  icon,
  label,
  detail,
  primary = false,
  preferred = false,
  onPress,
  testID,
}: TVCardSheetButtonProps) {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  return (
    <Focusable
      variant="button"
      focusRadius={RADIUS}
      scaleOverride={1.03}
      glowOverride={primary ? 0.45 : undefined}
      phantomPressGuard
      hasTVPreferredFocus={preferred}
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={onPress}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      testID={testID}
    >
      <View style={[styles.row, !primary && (focused ? styles.ghostFocused : styles.ghost)]}>
        {primary && (
          <LinearGradient
            colors={[BRAND.violet, BRAND.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.icon}>{icon}</View>
        <Text numberOfLines={1} style={[styles.label, primary && styles.labelPrimary]}>
          {label}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={[styles.detail, primary && styles.detailPrimary]}>
            {detail}
          </Text>
        ) : null}
        {primary && focused && <View pointerEvents="none" style={styles.ringOver} />}
      </View>
    </Focusable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: SHEET_BUTTON_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 22,
    borderRadius: RADIUS,
    overflow: "hidden",
  },
  ghost: { backgroundColor: "rgba(255, 255, 255, 0.07)" },
  ghostFocused: { backgroundColor: "rgba(255, 255, 255, 0.16)" },
  icon: { width: 26, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, color: Colors.textPrimary, fontSize: 19, fontFamily: Fonts.semibold },
  labelPrimary: { fontFamily: Fonts.bold },
  detail: { color: Colors.textSecondary, fontSize: 16, fontFamily: Fonts.medium },
  detailPrimary: { color: "rgba(255, 255, 255, 0.88)" },
  ringOver: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
});
