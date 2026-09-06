import { useMemo } from "react";
import { Modal, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { X, Check } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useUserId } from "@tentacle-tv/api-client";
import { groupOfflineEntries, seasonLabel, watchStateOf } from "@tentacle-tv/offline-core";
import { useOfflineList } from "@/hooks/offline/useOfflineList";
import type { OfflineEntry } from "@/offline/engineApi";
import { OfflineLocalImage } from "@/offline/library/OfflineLocalImage";
import { PLAYER, spacing, FONT_FAMILY, SHEET_MAX_WIDTH } from "@/theme";

interface Props {
  visible: boolean;
  seriesId: string;
  currentEpisodeId: string;
  onClose: () => void;
}

/**
 * Le sélecteur d'épisodes d'une lecture locale HORS LIGNE : les épisodes
 * complets de la série sur l'appareil, par saison, avec leur vignette
 * locale, la coche ou la barre, et l'épisode courant surligné. En ligne, le
 * sélecteur serveur (liste complète) reste celui du bureau.
 */
export function LocalPlayerEpisodePicker({ visible, seriesId, currentEpisodeId, onClose }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { t: td } = useTranslation("downloads");
  const userId = useUserId();
  const { data } = useOfflineList(userId);

  const sections = useMemo(() => {
    const complete = (data ?? []).filter((entry) => entry.status === "complete" && entry.kind === "episode" && entry.seriesId === seriesId);
    return groupOfflineEntries(complete).seasons.map((season) => ({
      key: season.key,
      title: seasonLabel((key, options) => td(key.replace(/^downloads:/, ""), options), season.seasonNumber),
      data: season.episodes,
    }));
  }, [data, seriesId, td]);

  const code = (entry: OfflineEntry): string =>
    entry.indexNumber != null ? `S${String(entry.parentIndexNumber ?? 1).padStart(2, "0")}E${String(entry.indexNumber).padStart(2, "0")} · ` : "";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: PLAYER.controlBg }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t("close")} />
          <SafeAreaView edges={["left", "right", "bottom"]} style={st.sheet}>
            <View style={st.header}>
              <Text style={st.title}>{t("seasonsEpisodes")}</Text>
              <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
                <X size={22} color={PLAYER.text} />
              </Pressable>
            </View>
            <SectionList
              sections={sections}
              keyExtractor={(entry) => entry.itemId}
              contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: spacing.screenPadding }}
              renderSectionHeader={({ section }) => <Text style={st.season}>{section.title}</Text>}
              renderItem={({ item: entry }) => {
                const current = entry.itemId === currentEpisodeId;
                const watch = watchStateOf(entry);
                return (
                  <Pressable
                    onPress={() => { onClose(); router.replace(`/watch/${entry.itemId}`); }}
                    style={({ pressed }) => [st.row, current && st.rowCurrent, pressed && { opacity: 0.8 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${code(entry)}${entry.title ?? ""}`}
                  >
                    <View style={st.thumb}>
                      <OfflineLocalImage itemId={entry.itemId} candidates={["primary.jpg", "series-primary.jpg"]} style={StyleSheet.absoluteFill} />
                      {watch.percent !== null && (
                        <View style={st.track}><View style={[st.fill, { width: `${watch.percent}%` }]} /></View>
                      )}
                    </View>
                    <Text numberOfLines={2} style={[st.label, current && st.labelCurrent]}>{code(entry)}{entry.title ?? entry.itemId}</Text>
                    {watch.watched && <Check size={16} color={PLAYER.text} />}
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const st = StyleSheet.create({
  sheet: { maxHeight: "84%", width: "100%", maxWidth: SHEET_MAX_WIDTH, alignSelf: "center", backgroundColor: PLAYER.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTopWidth: 1, borderColor: PLAYER.borderSubtle },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.screenPadding, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 18, fontFamily: FONT_FAMILY.bold, color: PLAYER.text },
  season: { color: PLAYER.textTertiary, fontSize: 12, fontFamily: FONT_FAMILY.semibold, letterSpacing: 0.6, textTransform: "uppercase", paddingVertical: 10, backgroundColor: PLAYER.bg },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10 },
  rowCurrent: { backgroundColor: PLAYER.controlBg },
  thumb: { width: 96, height: 54, borderRadius: 6, overflow: "hidden", backgroundColor: PLAYER.controlBg },
  track: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  fill: { height: "100%", backgroundColor: PLAYER.text },
  label: { flex: 1, color: PLAYER.text, fontSize: 14, fontFamily: FONT_FAMILY.medium },
  labelCurrent: { fontFamily: FONT_FAMILY.bold },
});
