/**
 * Octave mobile — la barre d'une sélection, posée au-dessus des onglets et du mini-lecteur : combien de titres,
 * « Tout sélectionner », puis les gestes que décrit le modèle PARTAGÉ (`selectionActions`, le même que le bureau) —
 * ajouter à une playlist, lire ensuite, ajouter à la file, aimer, et « Retirer » sur une playlist à soi. Verre de
 * Tentacle (`GlassSurface`), une icône et son mot par geste (44 pt et plus). Un geste fait, la sélection se ferme.
 */

import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CircleMinus, Heart, HeartOff, ListEnd, ListPlus, ListStart } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { likeOverrideOf, openPlaylistChooserForMany } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { bulkLikePlan, isDestructiveSelectionAction, queueActions, SELECTION_ACTION_LABEL, selectionActions, type SelectionActionId } from "@tentacle-tv/shared/octave";
import { GlassSurface } from "@/components/ui";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { showNotice } from "../env/notices";
import { usePagesPlayer } from "../env/pagesPlayer";
import { useMobileTrackActions } from "../env/useMobileActionsUi";

type IconType = ComponentType<{ size?: number; color?: string }>;
const ICONS: Record<SelectionActionId, IconType> = { addToPlaylist: ListPlus, playNext: ListStart, enqueue: ListEnd, like: Heart, unlike: HeartOff, remove: CircleMinus };

interface Props {
  count: number;
  total: number;
  /** Les titres choisis, dans l'ordre de la liste. */
  tracks: readonly MusicTrack[];
  bottom: number;
  onSelectAll: () => void;
  onDone: () => void;
  /** « Retirer » d'une playlist que le compte peut modifier ; absent : pas offert. */
  onRemove?: () => void;
}

export function MobileSelectionBar({ count, total, tracks, bottom, onSelectAll, onDone, onRemove }: Props) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const player = usePagesPlayer();
  const actions = useMobileTrackActions();
  const likePlan = bulkLikePlan(tracks, (tr) => likeOverrideOf(tr.key) ?? tr.favorite, actions.canLike);
  const ids = selectionActions({
    count,
    canAddToPlaylist: tracks.some(actions.canAddToPlaylist),
    canQueue: player !== null,
    like: likePlan.tracks.length > 0 ? { liked: likePlan.liked } : null,
    canRemove: !!onRemove,
  });
  const run = (id: SelectionActionId) => {
    haptic("tap");
    if (id === "addToPlaylist") openPlaylistChooserForMany(tracks.filter(actions.canAddToPlaylist));
    else if (id === "playNext" && player) {
      queueActions.playNext(player, tracks);
      showNotice("success", t("selection.playNext", { count: tracks.length }));
    } else if (id === "enqueue" && player) {
      queueActions.enqueue(player, tracks);
      showNotice("success", t("selection.queued", { count: tracks.length }));
    } else if (id === "like" || id === "unlike") {
      for (const track of likePlan.tracks) void actions.toggleLike(track, { quiet: true });
      showNotice("success", t(likePlan.liked ? "selection.liked" : "selection.unliked", { count: likePlan.tracks.length }));
    } else if (id === "remove") onRemove?.();
    onDone();
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <GlassSurface tier="sheet" tint="strong" radius={22} style={styles.bar}>
        <View style={styles.head}>
          <Text accessibilityLiveRegion="polite" style={[typography.bodyBold, { color: theme.colors.text.primary }]}>
            {count === 0 ? t("selection.none") : t("selection.count", { count })}
          </Text>
          {count < total ? (
            <Pressable onPress={onSelectAll} hitSlop={8} accessibilityRole="button" style={styles.all}>
              <Text style={[typography.bodyBold, { color: theme.colors.brand.accentLight }]}>{t("selection.selectAll")}</Text>
            </Pressable>
          ) : null}
        </View>
        {ids.length > 0 ? (
          <View accessibilityRole="toolbar" accessibilityLabel={t("selection.toolbar")} style={styles.actions}>
            {ids.map((id) => {
              const Icon = ICONS[id];
              const color = isDestructiveSelectionAction(id) ? theme.colors.status.error : theme.colors.text.primary;
              return (
                <Pressable key={id} onPress={() => run(id)} accessibilityRole="button" accessibilityLabel={t(SELECTION_ACTION_LABEL[id])} style={({ pressed }) => [styles.action, pressed && { backgroundColor: theme.colors.fill.soft }]}>
                  <Icon size={20} color={color} />
                  <Text numberOfLines={2} style={[typography.small, styles.label, { color }]}>{t(SELECTION_ACTION_LABEL[id])}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 20 },
  bar: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32, paddingHorizontal: 4 },
  all: { minHeight: 32, justifyContent: "center" },
  actions: { flexDirection: "row", justifyContent: "space-around" },
  action: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 12, paddingHorizontal: 2 },
  label: { textAlign: "center" },
});
