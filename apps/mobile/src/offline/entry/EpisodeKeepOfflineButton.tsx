import { Pressable, StyleSheet } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { KeepOfflineGlyph } from "./KeepOfflineGlyph";
import { useKeepOfflineEntry } from "./useKeepOfflineEntry";

interface Props {
  episode: MediaItem;
}

/** L'anneau compact d'une ligne d'épisode (30 pt, cible 44), à gauche du rond « vu ». */
export function EpisodeKeepOfflineButton({ episode }: Props) {
  const entry = useKeepOfflineEntry(episode);
  if (!entry.visible) return null;
  return (
    <Pressable
      onPress={entry.onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`${episode.Name ?? ""}, ${entry.label}`}
      style={st.wrap}
    >
      <KeepOfflineGlyph state={entry.state} size={30} iconSize={15} />
    </Pressable>
  );
}

const st = StyleSheet.create({
  wrap: { paddingLeft: 4, paddingRight: 2 },
});
