import { memo, useCallback, useState } from "react";
import { FlatList, View, type LayoutChangeEvent } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { TVEpisodeRow, EPISODE_ROW_GAP, episodeRowHeight } from "../TVEpisodeRow";
import { Spacing } from "../../theme/colors";

/** Réserve au-dessus de la première ligne : l'anneau se dessine hors de la case
 *  et le défilement rognerait celui d'une ligne collée au bord. */
const LIST_PAD_TOP = 8;

export interface EpisodeListRowsProps {
  episodes: MediaItem[];
  /** Index de la ligne qui prend le focus à l'ouverture (-1 : aucune). */
  claimIndex: number;
  claimNonce: number;
  highlightId: string | undefined;
  badgeFor: (episode: MediaItem) => string | null;
  thumbUrlFor: (episode: MediaItem) => string;
  thumbWidth: number;
  onPress: (episode: MediaItem) => void;
}

/**
 * Les épisodes du PANNEAU du lecteur : une liste virtualisée.
 *
 * Toutes les lignes étaient montées d'un coup — cent quatre-vingt-seize sur la
 * onzième saison de One Piece, chacune avec son image et ses calques de focus :
 * deux secondes de lignes fantômes à chaque ouverture. Seules les lignes à
 * l'écran, et deux écrans de part et d'autre, existent désormais.
 *
 * **Elle s'ouvre SUR l'épisode visé**, par `initialScrollIndex` : la liste ne
 * monte que ce qui l'entoure, et la ligne est à l'écran avant même de prendre
 * le focus. Plus de défilement programmé à l'ouverture, plus de `scrollTo` au
 * focus non plus : c'est le moteur de focus natif qui fait suivre la liste
 * (UIScrollView sur tvOS, `requestChildFocus` sur Android). Les deux se
 * battaient, sur des hauteurs de ligne fausses — d'où les sauts.
 *
 * La liste attend de connaître sa propre hauteur avant de naître : c'est ce qui
 * permet de ne pas dépasser la fin quand l'épisode visé est parmi les derniers.
 */
export const TVEpisodePanelList = memo(function TVEpisodePanelList({
  episodes, claimIndex, claimNonce, highlightId, badgeFor, thumbUrlFor, thumbWidth, onPress,
}: EpisodeListRowsProps) {
  const stride = episodeRowHeight(thumbWidth) + EPISODE_ROW_GAP;
  const [viewportH, setViewportH] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setViewportH((prev) => (prev > 0 ? prev : h));
  }, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: stride, offset: LIST_PAD_TOP + stride * index, index }),
    [stride],
  );

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => (
    <View style={{ height: stride }}>
      <TVEpisodeRow
        episode={item}
        index={index}
        thumbUrl={thumbUrlFor(item)}
        isCurrent={item.Id === highlightId}
        badgeLabel={badgeFor(item)}
        claimFocus={index === claimIndex}
        claimNonce={claimNonce}
        thumbWidth={thumbWidth}
        onPress={onPress}
      />
    </View>
  ), [stride, thumbUrlFor, highlightId, badgeFor, claimIndex, claimNonce, thumbWidth, onPress]);

  // Une ligne AU-DESSUS de la ligne visée, pour le contexte — sans dépasser la
  // fin : la dernière page reste pleine.
  const visible = viewportH > 0 ? Math.floor(viewportH / stride) : 0;
  const initialIndex = claimIndex > 0
    ? Math.max(0, Math.min(claimIndex - 1, episodes.length - visible))
    : 0;

  return (
    <View style={{ flex: 1, marginTop: 16 }} onLayout={onLayout}>
      {viewportH > 0 && (
        <FlatList
          data={episodes}
          keyExtractor={(ep) => ep.Id}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          initialScrollIndex={initialIndex > 0 ? initialIndex : undefined}
          initialNumToRender={Math.max(visible + 2, 6)}
          maxToRenderPerBatch={6}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: Spacing.screenPadding,
            paddingTop: LIST_PAD_TOP,
            paddingBottom: 24,
          }}
        />
      )}
    </View>
  );
});
