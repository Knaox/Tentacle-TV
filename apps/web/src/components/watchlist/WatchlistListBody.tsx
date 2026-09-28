import { useEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { MediaItem } from "@tentacle-tv/shared";
import type { SelectionMode } from "../collection/selectionMode";
import { WatchlistRow } from "./WatchlistRow";

/** Hauteur d'une ligne (affiche 16 × 24 + marges) plus l'écart. */
const ROW_ESTIMATE = 128;
const GAP = 10;

interface WatchlistListBodyProps {
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  pendingPlayId: string | null;
  onRemoved: (item: MediaItem) => void;
  selectionMode: SelectionMode;
  /** Empreinte de ce qui précède la liste — cf. `CollectionGridBody`. */
  headerKey: string;
}

/**
 * La vue liste, virtualisée comme la grille (`CollectionGridBody`) : une liste
 * de cinq cents titres ne monte que les lignes à l'écran, plus trois d'avance.
 * Lignes MESURÉES, pas supposées — la typographie peut grandir.
 */
export function WatchlistListBody({
  items, onOpen, onPlay, pendingPlayId, onRemoved, selectionMode, headerKey,
}: WatchlistListBodyProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    if (listRef.current) setScrollMargin(listRef.current.offsetTop);
  }, [headerKey]);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 3,
    scrollMargin,
  });

  return (
    <div ref={listRef}>
      <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index];
          return (
            <div
              key={item.Id}
              ref={virtualizer.measureElement}
              data-index={row.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                paddingBottom: GAP,
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <WatchlistRow
                item={item}
                onOpen={onOpen}
                onPlay={onPlay}
                playPending={pendingPlayId === item.Id}
                onRemoved={onRemoved}
                selecting={selectionMode.isSelecting}
                selected={selectionMode.isSelected(item.Id)}
                onToggleSelect={selectionMode.toggle}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
