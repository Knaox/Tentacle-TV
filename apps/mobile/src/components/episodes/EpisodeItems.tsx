import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { StyleSheet, View, type ScrollView } from "react-native";
import { useEpisodes, useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { SeasonActionBar } from "./SeasonActionBar";
import { EpisodeItemRow } from "./EpisodeItemRow";

interface Props {
  seriesId: string;
  seasonId: string;
  onPlay: (ep: MediaItem) => void;
  currentEpisodeId?: string;
  scrollTargetRef?: RefObject<ScrollView | null>;
  /** Pilule ajoutée à la barre de saison (« Toute la saison »). */
  seasonTrailing?: (episodes: MediaItem[]) => ReactNode;
  /** Bouton ajouté à chaque ligne, à gauche du rond « vu ». */
  rowLeading?: (ep: MediaItem) => ReactNode;
}

/** Les épisodes d'UNE saison : la barre de saison, puis une ligne par épisode. */
export function EpisodeItems({ seriesId, seasonId, onPlay, currentEpisodeId, scrollTargetRef, seasonTrailing, rowLeading }: Props) {
  const client = useJellyfinClient();
  const { data: episodes } = useEpisodes(seriesId, seasonId);

  // L'épisode courant s'amène à l'écran DE LUI-MÊME, une seule fois par
  // ouverture : une saison de quarante épisodes ne se parcourt plus au doigt.
  const currentRowRef = useRef<View | null>(null);
  const didAutoScrollRef = useRef(false);
  const hasCurrent = !!currentEpisodeId && !!episodes?.some((ep) => ep.Id === currentEpisodeId);
  useEffect(() => {
    if (!hasCurrent || didAutoScrollRef.current) return;
    const scroll = scrollTargetRef?.current;
    const row = currentRowRef.current;
    if (!scroll || !row) return;
    // Un tick pour laisser le layout se poser avant de mesurer. La position se
    // calcule en coordonnées FENÊTRE (delta ligne − scroll) : `measureLayout`
    // exigerait une ref native que le wrapper ScrollView n'expose pas.
    const timer = setTimeout(() => {
      const host = (scroll as unknown as {
        getNativeScrollRef?: () => { measureInWindow?: (cb: (x: number, y: number) => void) => void } | null;
      }).getNativeScrollRef?.();
      if (!host?.measureInWindow) return;
      row.measureInWindow((_rowX, rowY) => {
        host.measureInWindow!((_scrollX, scrollY) => {
          didAutoScrollRef.current = true;
          scroll.scrollTo({ y: Math.max(0, rowY - scrollY - 96), animated: false });
        });
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [hasCurrent, scrollTargetRef]);

  if (!episodes || episodes.length === 0) return null;

  return (
    <View style={st.wrap}>
      <SeasonActionBar seriesId={seriesId} seasonId={seasonId} episodes={episodes} trailing={seasonTrailing?.(episodes)} />
      <View style={st.list}>
        {episodes.map((ep) => {
          const isCurrent = ep.Id === currentEpisodeId;
          return (
            <View key={ep.Id} ref={isCurrent ? currentRowRef : undefined} collapsable={false}>
              <EpisodeItemRow
                ep={ep}
                seriesId={seriesId}
                seasonId={seasonId}
                client={client}
                onPlay={onPlay}
                isCurrent={isCurrent}
                leading={rowLeading?.(ep)}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { maxWidth: 640, width: "100%" },
  list: { paddingHorizontal: 16, gap: 8 },
});
