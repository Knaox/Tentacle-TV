import { memo, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, PLAYER, RADIUS, spacing, useTheme } from "@/theme";
import { copyToClipboard } from "@/utils/clipboard";
import { haptic } from "@/utils/haptics";

export type ProblemTone = "player" | "page";

interface Props {
  lines: string[];
  copy: string;
  tone: ProblemTone;
  align?: "start" | "center";
}

/** Le temps de lire « Copié » avant que le bouton ne redise « Copier ». */
const COPIED_MS = 2000;

/**
 * Les détails techniques, repliés : un mot pour les ouvrir, les lignes en
 * petit (sélectionnables), et « Copier » — la trace à transmettre à
 * l'administrateur. Jamais un jeton : le modèle les a masqués.
 */
export const ProblemDetails = memo(function ProblemDetails({ lines, copy, tone, align = "start" }: Props) {
  const { t } = useTranslation("errors");
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  if (lines.length === 0) return null;

  const player = tone === "player";
  const muted = player ? PLAYER.textTertiary : theme.colors.text.tertiary;
  const body = player ? PLAYER.textSecondary : theme.colors.text.secondary;
  const boxBg = player ? PLAYER.fillSoft : theme.colors.fill.subtle;
  const boxBorder = player ? PLAYER.borderSubtle : theme.colors.border.subtle;

  return (
    <View style={[st.root, align === "center" && st.center]}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? t("detailsHide") : t("details")}
        hitSlop={6}
        style={({ pressed }) => [st.toggle, pressed && st.pressed]}
      >
        <Text style={[st.toggleTxt, { color: muted }]}>{open ? t("detailsHide") : t("details")}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={muted} />
      </Pressable>
      {open && (
        <View style={[st.box, { backgroundColor: boxBg, borderColor: boxBorder }]}>
          {lines.map((line, index) => (
            <Text key={index} selectable style={[st.line, { color: body }]}>{line}</Text>
          ))}
          <Pressable
            onPress={() => {
              haptic("tap");
              if (copyToClipboard(copy)) setCopied(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={copied ? t("detailsCopied") : t("copyDetails")}
            style={({ pressed }) => [st.copy, { borderColor: boxBorder }, pressed && st.pressed]}
          >
            <Feather name={copied ? "check" : "copy"} size={14} color={body} />
            <Text style={[st.copyTxt, { color: body }]}>{copied ? t("detailsCopied") : t("copyDetails")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  root: { alignSelf: "stretch", alignItems: "flex-start" },
  center: { alignItems: "center" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingVertical: spacing.sm },
  toggleTxt: { fontSize: 13, fontFamily: FONT_FAMILY.medium },
  pressed: { opacity: 0.6 },
  box: {
    alignSelf: "stretch",
    gap: 4,
    padding: spacing.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  line: { fontSize: 12, lineHeight: 17, fontFamily: FONT_FAMILY.regular, fontVariant: ["tabular-nums"] },
  copy: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  copyTxt: { fontSize: 13, fontFamily: FONT_FAMILY.semibold },
});
