import { memo, useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { TVEpisodeRow, EPISODE_ROW_GAP, episodeRowHeight } from "../TVEpisodeRow";
import type { EpisodeListRowsProps } from "./TVEpisodePanelList";
import { Spacing } from "../../theme/colors";

/** Lignes montées d'emblée, puis tenues D'AVANCE sous la ligne focalisée. */
const FIRST_BATCH = 12;
const AHEAD = 12;

/**
 * Les épisodes de la FICHE : la liste vit dans le défilement de la page (un
 * défilement borné imbriqué piégeait le focus), donc elle ne peut pas être
 * virtualisée comme celle du panneau.
 *
 * Elle est montée PROGRESSIVEMENT : une douzaine de lignes d'abord, puis
 * toujours douze d'avance sous la ligne focalisée. Une saison de cent
 * quatre-vingt-seize épisodes ne se montait plus d'un bloc à l'arrivée des
 * données — le temps pendant lequel la fiche ne répondait plus. L'avance est
 * ce qui empêche le focus de sauter par-dessus la liste vers les rangées du
 * dessous : il y a toujours une ligne sous la ligne focalisée tant que la
 * saison n'est pas finie.
 *
 * La page défile d'elle-même vers la ligne focalisée (`onEpisodeFocus`), au
 * point près : les lignes ont une hauteur imposée.
 */
export const TVEpisodePageList = memo(function TVEpisodePageList({
  episodes, claimIndex, claimNonce, highlightId, badgeFor, thumbUrlFor, thumbWidth, onPress,
  onEpisodeFocus,
}: EpisodeListRowsProps & {
  /** Y local (relatif à la liste) de la ligne focalisée — la PAGE défile. */
  onEpisodeFocus?: (y: number) => void;
}) {
  const stride = episodeRowHeight(thumbWidth) + EPISODE_ROW_GAP;
  const total = episodes.length;
  const [rendered, setRendered] = useState(() =>
    Math.min(total, Math.max(FIRST_BATCH, claimIndex + AHEAD + 1)),
  );

  const focusRef = useRef(onEpisodeFocus);
  focusRef.current = onEpisodeFocus;
  const handleFocusIndex = useCallback((index: number) => {
    focusRef.current?.(index * stride);
    setRendered((count) => Math.max(count, Math.min(total, index + AHEAD + 1)));
  }, [stride, total]);

  return (
    <View style={{ marginTop: 16, paddingHorizontal: Spacing.screenPadding }}>
      {episodes.slice(0, rendered).map((ep, index) => (
        <View key={ep.Id} style={{ height: stride }}>
          <TVEpisodeRow
            episode={ep}
            index={index}
            thumbUrl={thumbUrlFor(ep)}
            isCurrent={ep.Id === highlightId}
            badgeLabel={badgeFor(ep)}
            claimFocus={index === claimIndex}
            claimNonce={claimNonce}
            thumbWidth={thumbWidth}
            onPress={onPress}
            onFocusIndex={handleFocusIndex}
          />
        </View>
      ))}
    </View>
  );
});
