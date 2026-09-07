import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, typography, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { formatBytes } from "../formatBytes";

interface Props {
  items: readonly MediaItem[];
  selected: ReadonlySet<string>;
  /** Titres déjà complets sur l'appareil : affichés cochés-gris, non sélectionnables. */
  onDevice: ReadonlySet<string>;
  sizeOf: (item: MediaItem) => number | null;
  onToggle: (itemId: string) => void;
}

function episodeCode(item: MediaItem): string {
  if (item.IndexNumber == null) return "";
  return `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `;
}

/** La liste cochable des épisodes d'une saison (ou d'une sélection). */
export function ItemChecklist({ items, selected, onDevice, sizeOf, onToggle }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const already = items.filter((item) => onDevice.has(item.Id)).length;
  return (
    <View style={st.list}>
      {already > 0 && <Text style={st.already}>{t("alreadyOnDevice", { count: already })}</Text>}
      {items.map((item) => {
        const kept = onDevice.has(item.Id);
        const checked = kept || selected.has(item.Id);
        const size = sizeOf(item);
        return (
          <Pressable
            key={item.Id}
            onPress={() => !kept && onToggle(item.Id)}
            disabled={kept}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: kept }}
            style={[st.row, kept && st.rowKept]}
          >
            <View style={[st.box, checked && st.boxChecked]}>
              {checked && <Feather name="check" size={14} color={colors.cta.brandFg} />}
            </View>
            <Text style={st.title} numberOfLines={1}>{episodeCode(item)}{item.Name}</Text>
            {size !== null && <Text style={st.size}>{formatBytes(size)}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { gap: 6 },
    already: { ...typography.caption, color: t.colors.text.tertiary, marginBottom: 2 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: RADIUS.md,
      backgroundColor: t.colors.fill.faint,
    },
    rowKept: { opacity: 0.5 },
    box: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.colors.border.strong,
      alignItems: "center",
      justifyContent: "center",
    },
    boxChecked: { backgroundColor: t.colors.brand.violet, borderColor: withAlpha(t.colors.brand.violet, 0.6, t.colors.brand.glow) },
    title: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary, flex: 1 },
    size: { ...typography.small, color: t.colors.text.quaternary },
  });
