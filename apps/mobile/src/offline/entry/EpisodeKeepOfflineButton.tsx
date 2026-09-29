import { Pressable, StyleSheet, View } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { KeepOfflineGlyph } from "./KeepOfflineGlyph";
import { useKeepOfflineEntry } from "./useKeepOfflineEntry";

interface Props {
  episode: MediaItem;
}

/**
 * L'anneau compact d'une ligne d'épisode (30 pt, cible 44), avant le « ⋯ » :
 * l'ACTION « garder hors ligne » (et son transfert en route). Un épisode déjà
 * sur l'appareil n'a plus d'anneau — la pastille de sa vignette le dit, et un
 * anneau vert l'aurait dit une seconde fois ; sa gestion passe par la feuille.
 * La place reste réservée : les titres des lignes restent alignés.
 */
export function EpisodeKeepOfflineButton({ episode }: Props) {
  const entry = useKeepOfflineEntry(episode);
  if (!entry.visible) return null;
  if (entry.state === "complete") return <View style={st.placeholder} />;
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
  // La largeur de l'anneau et de ses marges (30 + 4 + 2).
  placeholder: { width: 36 },
});
