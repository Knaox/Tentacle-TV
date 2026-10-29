/**
 * Octave mobile — une rangée de titre EN SÉLECTION : la case à gauche, la rangée des pages inerte (`editing` : ni
 * lecture, ni balayage, ni feuille), et toute la rangée coche ou décoche au toucher (44 pt et plus).
 */

import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { haptic } from "@/utils/haptics";
import { TrackRow } from "../ui/TrackRow";
import { SelectionCheck } from "./SelectionCheck";

interface Props {
  track: MusicTrack;
  index: number;
  list: readonly MusicTrack[];
  contextId: string;
  gutter: number;
  numbered?: boolean;
  hide?: { album?: boolean; artist?: boolean };
  selected: boolean;
  /** La clé de la rangée dans la sélection (`rowKey` d'une liste, la clé du titre ailleurs). */
  rowKey: string;
  onToggle: (key: string) => void;
}

const noop = () => undefined;

export const SelectableTrackRow = memo(function SelectableTrackRow({ track, index, list, contextId, gutter, numbered, hide, selected, onToggle, rowKey }: Props) {
  const { t } = useTranslation("music");
  return (
    <Pressable
      onPress={() => {
        haptic("select");
        onToggle(rowKey);
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={t("selection.select", { title: track.title })}
      style={[styles.row, { paddingLeft: gutter }]}
    >
      <SelectionCheck selected={selected} />
      <View style={styles.flex} pointerEvents="none">
        <TrackRow track={track} index={index} list={list} contextId={contextId} playing={false} onPlay={noop} gutter={12} numbered={numbered} hide={hide} editing />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  flex: { flex: 1, minWidth: 0 },
});
