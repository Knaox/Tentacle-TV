import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { mediaVersions, pickMediaSource, type MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, seasonTabGradient, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  item: MediaItem;
  /** La version choisie (`MediaSourceId`) ; `null` : celle de Jellyfin, la première. */
  value: string | null;
  onChange: (versionId: string) => void;
}

/**
 * Les VERSIONS d'un film — ou, depuis Jellyfin 12, d'un épisode : « 1080p »,
 * « 720p », « Director's Cut ». Jellyfin 12 réunit les fichiers d'un même
 * épisode en UNE entrée ; sans ce choix, les autres versions n'étaient plus
 * atteignables. Une pastille par version sous « Lecture », la choisie au
 * dégradé de marque (la grammaire des saisons). Une seule version : rien.
 */
export function DetailVersionPicker({ item, value, onChange }: Props) {
  const { t } = useTranslation("media");
  const st = useThemedStyles(makeStyles);
  const versions = mediaVersions(item.MediaSources);
  if (versions.length === 0) return null;
  // Sans choix (ou un choix périmé), celle que Jellyfin lirait : sa première.
  const selected = pickMediaSource(item.MediaSources, value)?.Id;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("detailVersionLabel")} style={st.row}>
      <Text style={st.caption}>{t("detailVersion")}</Text>
      {versions.map((v) => (
        <VersionPill key={v.id} id={v.id} label={v.label} active={v.id === selected} onChange={onChange} />
      ))}
    </View>
  );
}

const VersionPill = memo(function VersionPill({ id, label, active, onChange }: {
  id: string;
  label: string;
  active: boolean;
  onChange: (versionId: string) => void;
}) {
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => onChange(id)}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [st.pill, active && st.pillActive, pressed && st.pressed]}
    >
      {active && <LinearGradient {...seasonTabGradient(colors.brand)} style={StyleSheet.absoluteFill} />}
      <Text style={[st.label, { color: active ? colors.cta.brandFg : colors.text.primary }, active && st.labelActive]}>{label}</Text>
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.md },
    caption: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary, marginRight: 2 },
    pill: {
      minHeight: 44,
      paddingHorizontal: 16,
      justifyContent: "center",
      borderRadius: RADIUS.pill,
      overflow: "hidden",
      // Le verre des pastilles de saison : le libellé reste lisible sur la scène.
      backgroundColor: t.colors.glass.tintStrong,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border.strong,
    },
    pillActive: { borderColor: "transparent" },
    pressed: { transform: [{ scale: 0.97 }] },
    label: { fontSize: 14, fontFamily: FONT_FAMILY.medium, letterSpacing: 0.1 },
    labelActive: { fontFamily: FONT_FAMILY.semibold },
  });
