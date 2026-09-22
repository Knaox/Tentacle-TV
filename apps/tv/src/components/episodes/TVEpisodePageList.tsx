import { memo, useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { TVEpisodeRow, EPISODE_ROW_GAP, episodeRowHeight } from "../TVEpisodeRow";
import type { EpisodeListRowsProps } from "./TVEpisodePanelList";
import { Spacing } from "../../theme/colors";

/** Lignes montées d'emblée — de quoi remplir l'écran —, puis par lots, une
 *  image libre après l'autre, jusqu'au bout de la saison. */
const FIRST_BATCH = 12;
const BATCH = 24;

/**
 * Les épisodes de la FICHE : la liste vit dans le défilement de la page (un
 * défilement borné imbriqué piégeait le focus), donc elle ne peut pas être
 * virtualisée comme celle du panneau.
 *
 * Elle est montée PAR LOTS, en tâche de fond : une douzaine de lignes d'abord,
 * puis vingt-quatre à chaque image libre, jusqu'à la dernière. Une saison de
 * cent quatre-vingt-seize épisodes se montait d'un bloc à l'arrivée des
 * données, le temps pendant lequel la fiche ne répondait plus ; elle se monte
 * désormais en huit tranches, entre lesquelles la télécommande est servie.
 *
 * **Jusqu'au bout, et sans attendre le focus.** Un montage qui suivait le
 * focus (douze lignes d'avance) a été essayé et mesuré sur l'Apple TV : en
 * MAINTENANT « bas », tvOS accélère et fait défiler la page plus vite que les
 * lignes n'arrivent ; il traversait une zone sans rien de focalisable et
 * tombait sur les « Titres similaires », cent lignes trop tôt. La liste
 * complète, elle, garde le focus jusqu'au dernier épisode.
 *
 * La suite de la saison est réservée pleine hauteur pendant le montage : la
 * page a sa longueur définitive dès l'arrivée des données, et ce qui suit la
 * liste ne descend pas à chaque lot.
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
    Math.min(total, Math.max(FIRST_BATCH, claimIndex + FIRST_BATCH)),
  );

  // Le lot suivant à l'image d'après : le précédent est déjà peint, et les
  // appuis en attente passent entre deux lots.
  useEffect(() => {
    if (rendered >= total) return;
    const frame = requestAnimationFrame(() => {
      setRendered((count) => Math.min(total, count + BATCH));
    });
    return () => cancelAnimationFrame(frame);
  }, [rendered, total]);

  const focusRef = useRef(onEpisodeFocus);
  focusRef.current = onEpisodeFocus;
  const handleFocusIndex = useCallback((index: number) => {
    focusRef.current?.(index * stride);
  }, [stride]);

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
      {rendered < total && <View style={{ height: (total - rendered) * stride }} />}
    </View>
  );
});
