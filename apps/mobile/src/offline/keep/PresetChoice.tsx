import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LIGHT_PRESETS, type LightPresetId } from "@tentacle-tv/offline-core";
import { FONT_FAMILY, RADIUS, typography, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

interface Props {
  value: LightPresetId;
  onChange: (preset: LightPresetId) => void;
  /** Paliers que le serveur sert — un palier absent n'est pas proposé. */
  available: readonly string[];
}

/** Les paliers de l'Allégé : 1080p / 720p / 480p avec leur débit. */
export function PresetChoice({ value, onChange, available }: Props) {
  const { t } = useTranslation("downloads");
  const { t: to } = useTranslation("offline");
  const st = useThemedStyles(makeStyles);
  const presets = LIGHT_PRESETS.filter((preset) => available.includes(preset.id));
  if (presets.length === 0) return null;
  return (
    <View>
      <Text style={st.label}>{t("presetLabel")}</Text>
      <View style={st.row}>
        {presets.map((preset) => {
          const selected = preset.id === value;
          return (
            <Pressable
              key={preset.id}
              onPress={() => onChange(preset.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[st.cell, selected && st.cellSelected]}
            >
              <Text style={[st.title, selected && st.titleSelected]}>{preset.maxHeight}p</Text>
              <Text style={st.bitrate}>{to("presetBitrate", { mbps: Math.round(preset.videoBitRate / 1_000_000) })}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    label: { ...typography.caption, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.tertiary, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
    row: { flexDirection: "row", gap: 8 },
    cell: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    cellSelected: {
      backgroundColor: withAlpha(t.colors.brand.violet, 0.16, t.colors.brand.soft),
      borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow),
    },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary },
    titleSelected: { color: t.colors.text.primary },
    bitrate: { ...typography.small, color: t.colors.text.quaternary, marginTop: 2 },
  });
