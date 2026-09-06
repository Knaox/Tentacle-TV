import { useCallback, useMemo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useBatchWatchedToggle } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTheme, useThemedStyles, type AppTheme } from "@/theme";

let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: { Medium: unknown } } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* module natif absent */ }

interface Props {
  seriesId: string;
  seasonId: string;
  episodes: MediaItem[];
  /** Une pilule de plus, à droite de « tout vu » (« Toute la saison » hors ligne). */
  trailing?: ReactNode;
}

/** La barre d'une saison : marquer toute la saison vue / non vue, et ce qu'on y ajoute. */
export function SeasonActionBar({ seriesId, seasonId, episodes, trailing }: Props) {
  const { t } = useTranslation("common");
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  const batchCtx = useMemo(() => ({ seriesId, seasonId }), [seriesId, seasonId]);
  const { markWatched, markUnwatched } = useBatchWatchedToggle(batchCtx);
  const allWatched = useMemo(() => episodes.every((ep) => ep.UserData?.Played), [episodes]);
  const episodeIds = useMemo(() => episodes.map((ep) => ep.Id), [episodes]);
  const isBusy = markWatched.isPending || markUnwatched.isPending;

  const handleToggle = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (allWatched) markUnwatched.mutate(episodeIds);
    else markWatched.mutate(episodeIds);
  }, [allWatched, episodeIds, markWatched, markUnwatched]);

  return (
    <View style={st.bar}>
      <Pressable onPress={handleToggle} disabled={isBusy} style={[st.pill, isBusy && st.busy]}>
        <Feather name={allWatched ? "eye-off" : "eye"} size={14} color={colors.text.tertiary} />
        <Text style={st.label}>{allWatched ? t("markSeasonUnwatched") : t("markSeasonWatched")}</Text>
      </Pressable>
      {trailing}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    bar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 10 },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: t.colors.fill.subtle,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    busy: { opacity: 0.4 },
    label: { color: t.colors.text.tertiary, fontSize: 12, fontWeight: "600" },
  });
