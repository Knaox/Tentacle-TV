/**
 * Octave — les rangées d'une GRANDE liste (playlist, likés), virtualisées : seules celles à l'écran
 * (et quelques-unes autour) existent, posées par `transform` dans la zone qui défile d'Octave
 * (`#octave-main`). Le glisser déplace la rangée tenue et écarte les autres par `transform` seulement ;
 * la rangée tenue reste montée même si le défilement l'emmène loin.
 */

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import type { ReorderBlock } from "@tentacle-tv/api-client";
import type { HandleSlot } from "./DragHandle";
import { ROW_HEIGHT, rowShift } from "@tentacle-tv/shared/octave";
import { useRowDrag } from "./useRowDrag";

const SCROLL_ID = "octave-main";
const scrollElement = () => document.getElementById(SCROLL_ID);

interface VirtualTrackRowsProps {
  count: number;
  keyAt: (index: number) => string;
  titleAt: (index: number) => string;
  renderRow: (index: number, handle: HandleSlot | null) => ReactNode;
  reorder: { block: ReorderBlock | null; onMove: (from: number, to: number) => void } | null;
}

/** Le haut de la liste DANS le contenu qui défile (la tête de page au-dessus). */
function useScrollMargin(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      const root = scrollElement();
      if (!el || !root) return;
      setMargin(Math.round(el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop));
    };
    measure();
    const observer = new ResizeObserver(measure);
    const root = scrollElement();
    if (root?.firstElementChild) observer.observe(root.firstElementChild);
    return () => observer.disconnect();
  }, [count]);
  return { ref, margin };
}

export function VirtualTrackRows({ count, keyAt, titleAt, renderRow, reorder }: VirtualTrackRowsProps) {
  const { t } = useTranslation("music");
  const { ref, margin } = useScrollMargin(count);
  const onMove = useCallback((from: number, to: number) => reorder?.onMove(from, to), [reorder]);
  const { drag, handleProps } = useRowDrag(count, onMove, scrollElement);
  const held = drag?.from ?? null;
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      return held === null || indexes.includes(held) ? indexes : [...indexes, held].sort((a, b) => a - b);
    },
    [held],
  );
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: scrollElement,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: margin,
    getItemKey: keyAt,
    rangeExtractor,
  });
  const blocked = reorder?.block ? t(`listOrder.blocked.${reorder.block}`) : null;
  // Une poignée STABLE par rangée : pendant le geste, seules les enveloppes bougent (les rangées mémoïsées ne se redessinent pas).
  const slots = useRef(new Map<string, HandleSlot>());
  const slotFor = (index: number, key: string, lifted: boolean): HandleSlot => {
    const title = titleAt(index);
    const known = slots.current.get(key);
    if (known && known.lifted === lifted && known.blocked === blocked && known.title === title && known.index === index) return known;
    const slot = { index, title, blocked, lifted, props: handleProps(index) };
    slots.current.set(key, slot);
    return slot;
  };

  return (
    <div ref={ref} style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((item) => {
        const lifted = drag !== null && item.index === drag.from;
        const shift = drag === null ? 0 : lifted ? drag.offset : rowShift(item.index, drag.from, drag.over);
        const handle = reorder ? slotFor(item.index, String(item.key), lifted) : null;
        return (
          <div
            key={item.key}
            data-index={item.index}
            className={`absolute inset-x-0 top-0 ${drag && !lifted ? "transition-transform duration-150 ease-out motion-reduce:transition-none" : ""} ${
              lifted ? "z-10 rounded-md bg-[var(--oc-ink-raised)] shadow-[var(--oc-shadow-panel)]" : ""
            }`}
            style={{ height: ROW_HEIGHT, transform: `translateY(${item.start - margin + shift}px)` }}
          >
            {renderRow(item.index, handle)}
          </div>
        );
      })}
    </div>
  );
}
