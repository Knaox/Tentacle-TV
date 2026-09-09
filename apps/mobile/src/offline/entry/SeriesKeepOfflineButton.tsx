import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSeriesEpisodes, useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import { useOfflineVisibility } from "@/hooks/offline/useOfflineVisibility";
import { typography, FONT_FAMILY, useTheme } from "@/theme";
import { openKeepOffline } from "../keep/keepOfflineStore";
import { KeepOfflineGlyph, type KeepOfflineState } from "./KeepOfflineGlyph";

interface Props {
  series: MediaItem;
}

/**
 * Le quatrième bouton d'une fiche de SÉRIE : « Toute la série ». Les
 * épisodes ne sont demandés qu'à l'appui (une requête, tous les épisodes avec
 * leurs pistes) ; le dialogue s'ouvre dès qu'ils arrivent, avec le choix des
 * saisons. Un point lumineux tant qu'un épisode de la série est en
 * préparation.
 */
export function SeriesKeepOfflineButton({ series }: Props) {
  const { t } = useTranslation("offline");
  const { colors } = useTheme();
  const router = useRouter();
  const userId = useUserId();
  const { canKeep } = useOfflineVisibility();
  const { data: entries } = useOfflineList(userId);
  const [wanted, setWanted] = useState(false);
  const { data: episodes, isError } = useSeriesEpisodes(series.Id, { enabled: wanted });

  const active = (entries ?? []).some(
    (entry) => entry.seriesId === series.Id && (entry.status === "queued" || entry.status === "downloading" || entry.status === "paused"),
  );
  const state: KeepOfflineState = active ? "active" : "idle";

  useEffect(() => {
    if (!wanted) return;
    if (isError) { setWanted(false); return; }
    if (!episodes) return;
    setWanted(false);
    openKeepOffline({ mode: "series", items: episodes, seriesId: series.Id, title: series.Name });
  }, [wanted, episodes, isError, series.Id, series.Name]);

  if (!canKeep && !active) return null;
  const label = active ? t("stateInProgress") : t("keepSeriesOffline");
  return (
    <Pressable
      onPress={() => (active ? router.push("/on-device") : setWanted(true))}
      style={({ pressed }) => [st.cell, (pressed || wanted) && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
    >
      <KeepOfflineGlyph state={state} size={52} iconSize={22} />
      <Text numberOfLines={1} ellipsizeMode="tail" style={[st.label, { color: colors.text.secondary }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  cell: { width: "25%" as unknown as number, height: 88, alignItems: "center", justifyContent: "flex-start", paddingTop: 2, gap: 8 },
  label: { ...typography.badge, fontFamily: FONT_FAMILY.semibold, fontSize: 11.5, letterSpacing: 0.2, textAlign: "center", maxWidth: 80 },
});
