/**
 * Octave mobile — une rangée de titre d'une liste qu'on peut réordonner : la rangée des pages (`TrackRow`,
 * m3), précédée en mode « Modifier » du bouton « retirer » (rouge, 44 pt) et suivie de la poignée (44 pt, la
 * seule zone qui glisse : le reste de la rangée lit et défile comme partout). Le mouvement du glisser est
 * celui de la case qui la porte (`ReorderList`) : la rangée ne fait qu'étaler la poignée qu'on lui donne.
 * Au lecteur d'écran, la poignée offre « Monter » et « Descendre » (le glisser a toujours son équivalent).
 */

import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { GripVertical, MinusCircle } from "lucide-react-native";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useTheme } from "@/theme";
import { TrackRow, TRACK_ROW_HEIGHT } from "../../pages";
import { SelectionCheck } from "../../pages/selection/SelectionCheck";
import type { ReorderSlot } from "../../reorder/ReorderList";

interface ReorderRowProps {
  track: MusicTrack;
  index: number;
  list: readonly MusicTrack[];
  contextId: string;
  playing: boolean;
  onPlay: (index: number) => void;
  gutter: number;
  /** La poignée (absente si l'ordre ne se change pas ici : recherche, filtre, tri…) et « Monter / Descendre ». */
  slot: ReorderSlot;
  /** Mode « Modifier » d'une playlist modifiable : le bouton « retirer ». */
  onRemove?: (index: number) => void;
  /** Mode « Modifier » : la rangée ne lit ni ne se balaie ; seuls poignée et « – » agissent. */
  editing: boolean;
  /**
   * Mode « Modifier » avec sélection (ajout du 29/10) : la case remplace le « – », toucher la rangée la coche ;
   * « Retirer » passe dans la barre de sélection. La poignée reste : un seul mode coche ET réordonne.
   */
  selected?: boolean;
  onToggle?: (index: number) => void;
  /** Hors « Modifier », là où on peut retirer : le balayage vers la gauche retire le titre. */
  onSwipeRemove?: (index: number) => void;
}

export const ReorderRow = memo(function ReorderRow(props: ReorderRowProps) {
  const { track, index, list, contextId, playing, onPlay, gutter, slot, onRemove, editing, selected = false, onToggle, onSwipeRemove } = props;
  const { handle, onStep, lifted } = slot;
  const toggling = editing && onToggle !== undefined;
  const { t } = useTranslation("musicLists");
  const { t: tm } = useTranslation("music");
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {toggling ? (
        <Pressable
          onPress={() => onToggle(index)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={tm("selection.select", { title: track.title })}
          style={[styles.remove, { marginLeft: gutter - 10 }]}
        >
          <SelectionCheck selected={selected} />
        </Pressable>
      ) : onRemove ? (
        <Pressable
          onPress={() => onRemove(index)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t("removeRow", { title: track.title })}
          style={[styles.remove, { marginLeft: gutter - 10 }]}
        >
          <MinusCircle size={22} color={theme.colors.status.error} />
        </Pressable>
      ) : null}
      {toggling ? (
        <Pressable style={styles.flex} onPress={() => onToggle(index)} accessible={false}>
          <View pointerEvents="none">
            <TrackRow track={track} index={index} list={list} contextId={contextId} playing={playing} onPlay={onPlay} gutter={4} editing />
          </View>
        </Pressable>
      ) : (
        <View style={styles.flex}>
          <TrackRow track={track} index={index} list={list} contextId={contextId} playing={playing} onPlay={onPlay} gutter={onRemove ? 4 : gutter} editing={editing} onRemove={onSwipeRemove} />
        </View>
      )}
      {handle ? (
        <View
          {...handle}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={tm("listOrder.handle", { title: track.title })}
          accessibilityHint={t("reorderHint")}
          accessibilityActions={[
            { name: "increment", label: t("moveUp") },
            { name: "decrement", label: t("moveDown") },
          ]}
          onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === "increment" ? -1 : 1)}
          style={[styles.handle, { marginRight: gutter - 10 }]}
        >
          <GripVertical size={20} color={lifted ? theme.colors.brand.accentLight : theme.colors.text.tertiary} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { height: TRACK_ROW_HEIGHT, flexDirection: "row", alignItems: "center" },
  flex: { flex: 1, minWidth: 0 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  handle: { width: 44, height: TRACK_ROW_HEIGHT, alignItems: "center", justifyContent: "center" },
});
