import { memo, useCallback, type ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { OPEN_ROW_REVEAL, type OpenCardMetrics } from "@tentacle-tv/tv-core";
import type { CardModel } from "../cards/cardTypes";
import { FocusSection } from "../focus/FocusSection";
import { useRowRewindPort } from "../rows/rowRewindPort";
import { OpenRow } from "./OpenRow";

/**
 * Une rangée de la page en rangées (`OpenRowsBody` : une bibliothèque, Ma
 * liste, Mes favoris) — sa SECTION (`section:<rangée>`) qui se pose toujours
 * au même endroit (`OPEN_ROW_REVEAL`) et la carte focalisée au retrait
 * (`rowRevealStart`), sa rangée qui s'ouvre (`OpenRow`), et sa place dite au
 * port des rangées (retour au début une fois sortie de l'écran).
 */
export const OpenRowSection = memo(function OpenRowSection({
  rowKey, title, count, cards, metrics, pending, accessory, okHint, rank, onLayout, onPressCard, onLongPressCard, onFocusCard, onNearEnd,
}: {
  rowKey: string;
  title: string;
  count?: number;
  cards: CardModel[];
  metrics: OpenCardMetrics;
  pending?: boolean;
  accessory?: ReactNode;
  okHint?: string;
  rank?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
  onNearEnd?: () => void;
}) {
  const rewind = useRowRewindPort();
  const layout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      const { y, height } = event.nativeEvent.layout;
      rewind?.layout(rowKey, y, height);
    },
    [onLayout, rewind, rowKey],
  );
  return (
    <FocusSection focusKey={`section:${rowKey}`} reveal={OPEN_ROW_REVEAL} rowRevealStart onLayout={layout}>
      <OpenRow
        rowKey={rowKey}
        title={title}
        count={count}
        cards={cards}
        metrics={metrics}
        inset={TV_STAGE.contentLeft}
        stageRank={rank}
        pending={pending}
        accessory={accessory}
        okHint={okHint}
        onPressCard={onPressCard}
        onLongPressCard={onLongPressCard}
        onFocusCard={onFocusCard}
        onNearEnd={onNearEnd}
      />
    </FocusSection>
  );
});
