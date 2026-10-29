/**
 * Octave — « Réordonner » une section de la bibliothèque (ses favoris, ses playlists) : une liste dans une
 * fenêtre, chaque rangée tirée par sa POIGNÉE (souris, stylet, doigt : `useRowDrag`, Échap annule) ou montée et
 * descendue par ses flèches (clavier, lecteurs d'écran — jamais le glisser seul). Chaque geste se garde aussitôt
 * (`shelf.move`, optimiste) et se dit à voix haute. Tout est en `transform` pendant le geste.
 */

import { useCallback, useId, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ROW_HEIGHT, rowShift } from "@tentacle-tv/shared/octave";
import { Modal } from "../../../components/ui/Modal";
import { useRowDrag } from "../listOrder/useRowDrag";

export interface ReorderRow {
  key: string;
  title: string;
  subtitle: string;
  artwork: React.ReactNode;
}

interface Props {
  rows: readonly ReorderRow[];
  onMove: (key: string, to: number) => void;
  onClose: () => void;
}

const arrowClass =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-content-tertiary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent";

export function ShelfReorderDialog({ rows, onMove, onClose }: Props) {
  const { t } = useTranslation("musicFavorites");
  const titleId = useId();
  const hintId = useId();
  const scroller = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState("");
  const move = useCallback(
    (from: number, to: number) => {
      const row = rows[from];
      if (!row || to < 0 || to >= rows.length || to === from) return;
      onMove(row.key, to);
      setSaid(t("reorder.moved", { name: row.title, position: to + 1, total: rows.length }));
    },
    [rows, onMove, t],
  );
  const { drag, handleProps } = useRowDrag(rows.length, move, () => scroller.current);
  return (
    <Modal open onClose={onClose} maxWidth={520} labelledBy={titleId} describedBy={hintId}>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="oc-heading text-xl text-content-primary">
            {t("reorder.title")}
          </h2>
          <p id={hintId} className="text-sm text-content-tertiary">
            {t("reorder.hint")}
          </p>
        </div>
        <div ref={scroller} className="relative max-h-[60vh] overflow-y-auto overscroll-contain">
          <ol className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
            {rows.map((row, index) => {
              const lifted = drag !== null && drag.from === index;
              const shift = drag === null ? 0 : lifted ? drag.offset : rowShift(index, drag.from, drag.over);
              return (
                <li
                  key={row.key}
                  className={`absolute inset-x-0 top-0 flex items-center gap-3 px-1 ${drag && !lifted ? "transition-transform duration-150 ease-out motion-reduce:transition-none" : ""} ${lifted ? "z-10 rounded-md bg-[var(--oc-ink-raised)] shadow-[var(--oc-shadow-panel)]" : ""}`}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${index * ROW_HEIGHT + shift}px)` }}
                >
                  <button
                    type="button"
                    aria-label={t("reorder.handle", { name: row.title })}
                    title={t("reorder.handle", { name: row.title })}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    {...handleProps(index)}
                    // Au doigt, la poignée tire la rangée au lieu de faire défiler la liste.
                    style={{ touchAction: "none" }}
                    className="flex h-11 w-8 shrink-0 cursor-grab items-center justify-center rounded text-content-tertiary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" aria-hidden />
                  </button>
                  <div className="h-10 w-10 shrink-0">{row.artwork}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-content-primary" title={row.title}>
                      {row.title}
                    </p>
                    {row.subtitle && <p className="truncate text-[13px] text-content-tertiary">{row.subtitle}</p>}
                  </div>
                  <button type="button" className={arrowClass} disabled={index === 0} aria-label={t("reorder.moveUp", { name: row.title })} onClick={() => move(index, index - 1)}>
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className={arrowClass} disabled={index === rows.length - 1} aria-label={t("reorder.moveDown", { name: row.title })} onClick={() => move(index, index + 1)}>
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="octave-brand-fill inline-flex h-11 cursor-pointer items-center justify-center rounded-full px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t("reorder.done")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
