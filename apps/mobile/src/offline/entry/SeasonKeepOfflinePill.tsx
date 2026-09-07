import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { MediaItem } from "@tentacle-tv/shared";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { openKeepOffline } from "../keep/keepOfflineStore";

interface Props {
  episodes: MediaItem[];
}

/** La pilule « Toute la saison » de la barre de saison : le dialogue en lot. */
export function SeasonKeepOfflinePill({ episodes }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const { canKeep } = useOfflineVisibility();
  if (!canKeep || episodes.length === 0) return null;
  const seriesName = episodes[0]?.SeriesName;
  return (
    <Pressable
      onPress={() => openKeepOffline({ mode: "season", items: episodes, title: seriesName })}
      accessibilityRole="button"
      accessibilityLabel={t("keepSeasonOffline")}
      style={({ pressed }) => [st.pill, pressed && { opacity: 0.7 }]}
    >
      <Feather name="download" size={14} color={colors.text.tertiary} />
      <Text style={st.label}>{t("keepSeasonOffline")}</Text>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.colors.fill.subtle,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    label: { color: t.colors.text.tertiary, fontSize: 12, fontWeight: "600" },
  });
