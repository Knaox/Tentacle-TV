import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";

export type PillStatus = "idle" | "busy" | "done" | "error";

/**
 * Un geste du tableau de bord, qui se voit jusqu'au bout : il travaille
 * (anneau, et il ne se relance pas), puis dit « Envoyé » ou « Échec » le
 * temps de le lire (`buttonStatus`, partagé avec le bureau). Trois tons : neutre, marque
 * (écrire), danger (arrêter).
 */
export const ActionPill = memo(function ActionPill({
  label, icon, tone = "neutral", status = "idle", doneLabel, errorLabel, iconOnly = false, onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  tone?: "neutral" | "brand" | "danger";
  status?: PillStatus;
  doneLabel?: string;
  errorLabel?: string;
  /** Rangée compacte : l'icône seule, le libellé reste pour le lecteur d'écran. */
  iconOnly?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const colors = {
    neutral: { bg: theme.colors.fill.soft, fg: theme.colors.text.primary, border: theme.colors.border.subtle },
    brand: { bg: theme.colors.brand.soft, fg: theme.colors.brand.light, border: theme.colors.brand.glow },
    danger: { bg: theme.colors.danger.surface, fg: theme.colors.status.error, border: theme.colors.danger.border },
  }[tone];
  const busy = status === "busy";
  const shown = status === "done" && doneLabel ? doneLabel : status === "error" && errorLabel ? errorLabel : label;
  const glyph = status === "done" ? "check" : status === "error" ? "alert-circle" : icon;
  const fg = status === "done" ? theme.colors.statusPairs.success.fg : status === "error" ? theme.colors.status.error : colors.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      style={({ pressed }) => [
        st.pill,
        iconOnly && st.iconOnly,
        { backgroundColor: colors.bg, borderColor: colors.border },
        pressed && st.pressed,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={colors.fg} /> : <Feather name={glyph} size={15} color={fg} />}
      {!iconOnly && <Text style={[st.text, { color: fg }]} numberOfLines={1}>{shown}</Text>}
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 6,
      height: 40,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
    },
    iconOnly: { width: 40, paddingHorizontal: 0 },
    pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
    text: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  });
