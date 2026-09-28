import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { SwipeVerdict } from "@tentacle-tv/api-client";
import { FONT_FAMILY, useTheme } from "@/theme";

interface Props {
  disabled: boolean;
  canUndo: boolean;
  onJudge: (verdict: SwipeVerdict) => void;
  onUndo: () => void;
}

/**
 * Les cinq gestes en boutons — l'alternative visible au glisser. Les trois
 * verdicts font 60 pt, annuler et passer 46 pt (cibles ≥ 44 pt), chacun
 * avec son libellé lu par VoiceOver et un libellé court visible dessous.
 */
export const SwipeControls = memo(function SwipeControls({ disabled, canUndo, onJudge, onUndo }: Props) {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  const c = theme.colors;
  const specs = [
    { key: "undo", icon: "rotate-ccw" as const, size: 46, color: c.text.secondary, label: t("undoShort"), a11y: t("undo"), off: !canUndo, press: onUndo },
    { key: "dislike", icon: "x" as const, size: 60, color: c.status.error, label: t("dislike"), a11y: t("dislike"), off: disabled, press: () => onJudge("dislike") },
    { key: "superlike", icon: "star" as const, size: 60, color: "#fff", label: t("superlike"), a11y: t("superlike"), off: disabled, press: () => onJudge("superlike") },
    { key: "like", icon: "heart" as const, size: 60, color: c.status.success, label: t("like"), a11y: t("like"), off: disabled, press: () => onJudge("like") },
    { key: "skip", icon: "skip-forward" as const, size: 46, color: c.text.secondary, label: t("skip"), a11y: t("skip"), off: disabled, press: () => onJudge("skip") },
  ];

  return (
    <View style={st.row}>
      {specs.map((s) => (
        <View key={s.key} style={st.col}>
          <Pressable
            onPress={s.press}
            disabled={s.off}
            accessibilityRole="button"
            accessibilityLabel={s.a11y}
            accessibilityState={{ disabled: s.off }}
            hitSlop={6}
            style={({ pressed }) => [
              st.btn,
              {
                width: s.size,
                height: s.size,
                borderRadius: s.size / 2,
                backgroundColor: c.surface.s2,
                borderColor: c.border.subtle,
                opacity: s.off ? 0.4 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            {s.key === "superlike" && (
              <LinearGradient
                colors={[c.brand.violet, c.brand.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: s.size / 2 }]}
              />
            )}
            <Feather name={s.icon} size={s.size > 50 ? 26 : 20} color={s.color} />
          </Pressable>
          <Text
            style={[st.label, { color: c.text.tertiary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
});

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", paddingHorizontal: 8 },
  // Colonnes souples : « Coup de cœur » tient en entier jusqu'à 375 pt.
  col: { flex: 1, maxWidth: 88, alignItems: "center", gap: 6 },
  btn: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  label: { fontSize: 11, fontFamily: FONT_FAMILY.medium, fontWeight: "500" },
});
