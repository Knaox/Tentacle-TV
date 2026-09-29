import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { StyleSheet, View, type ScrollView } from "react-native";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { SeasonActionBar } from "./SeasonActionBar";
import { EpisodeItemRow } from "./EpisodeItemRow";
import { useProgressiveCount } from "./useProgressiveCount";

/** Hauteur d'une ligne avant la première mesure : celle d'une ligne à vignette 16:9. */
const ROW_ESTIMATE = 96;
/** L'écart entre deux lignes (`gap` de la liste). */
const ROW_GAP = 8;

interface Props {
  seriesId: string;
  seasonId: string;
  /** Les épisodes de la saison — sources comprises dès qu'elles sont là. */
  episodes: MediaItem[];
  /** La même liste, une fois les sources arrivées : « Toute la saison » en a besoin (tailles). */
  withSources?: MediaItem[];
  onPlay: (ep: MediaItem) => void;
  currentEpisodeId?: string;
  scrollTargetRef?: RefObject<ScrollView | null>;
  /** Pilule ajoutée à la barre de saison (« Toute la saison »). */
  seasonTrailing?: (episodes: MediaItem[]) => ReactNode;
  /** Bouton ajouté à chaque ligne, à gauche du rond « vu ». */
  rowLeading?: (ep: MediaItem) => ReactNode;
  /** L'appui long d'une ligne (la feuille des cartes, sur la fiche). */
  onLongPressEpisode?: (ep: MediaItem) => void;
}

/**
 * Les épisodes d'UNE saison : la barre de saison, puis une ligne par épisode,
 * montées par lots (`useProgressiveCount`) ; la hauteur des lignes à venir est
 * réservée, la page ne grandit pas par à-coups sous le doigt.
 */
export function EpisodeItems({ seriesId, seasonId, episodes, withSources, onPlay, currentEpisodeId, scrollTargetRef, seasonTrailing, rowLeading, onLongPressEpisode }: Props) {
  const client = useJellyfinClient();
  const currentIndex = currentEpisodeId ? episodes.findIndex((ep) => ep.Id === currentEpisodeId) : -1;
  const mounted = useProgressiveCount(episodes.length, seasonId, currentIndex);
  const [rowHeight, setRowHeight] = useState(ROW_ESTIMATE);

  // L'épisode courant s'amène à l'écran DE LUI-MÊME, une seule fois par
  // ouverture : une saison de quarante épisodes ne se parcourt plus au doigt.
  const currentRowRef = useRef<View | null>(null);
  const didAutoScrollRef = useRef(false);
  const hasCurrent = currentIndex >= 0;
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

  if (episodes.length === 0) return null;
  const pending = episodes.length - mounted;

  return (
    <View style={st.wrap}>
      <SeasonActionBar seriesId={seriesId} seasonId={seasonId} episodes={episodes} trailing={withSources ? seasonTrailing?.(withSources) : undefined} />
      <View
        style={st.list}
        // La hauteur moyenne d'une ligne, mesurée sur ce qui est monté : la
        // réserve des lignes à venir colle à la réalité dès le premier lot.
        onLayout={(e) => {
          if (pending <= 0 || mounted === 0) return;
          const measured = (e.nativeEvent.layout.height - pending * (rowHeight + ROW_GAP) + ROW_GAP) / mounted - ROW_GAP;
          if (measured > 24 && Math.abs(measured - rowHeight) > 2) setRowHeight(measured);
        }}
      >
        {episodes.slice(0, mounted).map((ep) => {
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
                onLongPress={onLongPressEpisode}
              />
            </View>
          );
        })}
        {pending > 0 && <View style={{ height: pending * (rowHeight + ROW_GAP) - ROW_GAP }} />}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { maxWidth: 640, width: "100%" },
  list: { paddingHorizontal: 16, gap: 8 },
});
