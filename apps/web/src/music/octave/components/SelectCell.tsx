/**
 * Octave — la case à cocher d'une rangée (sélection multiple) : révélée au survol ou au focus de la rangée,
 * visible sur TOUTES les rangées dès qu'une sélection existe. Maj-clic sur la case étend comme sur la rangée.
 * Une vraie case pour les lecteurs d'écran (`role="checkbox"`), 24 × 32 px de cible.
 */

import { memo } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SelectGesture } from "@tentacle-tv/shared/octave";

const HOVER_CLASS = "octave-hover-reveal opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100";

export const SelectCell = memo(function SelectCell({ title, selected, selecting, onSelect, cell = true }: {
  title: string;
  selected: boolean;
  selecting: boolean;
  onSelect: (gesture: SelectGesture) => void;
  /** Dans une grille (rangée de liste) : sa cellule ; ailleurs (la file), la case seule. */
  cell?: boolean;
}) {
  const { t } = useTranslation("music");
  const box = (
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={t("selection.select", { title })}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e.shiftKey ? "range" : "toggle");
        }}
        className={`flex h-8 w-6 cursor-pointer items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${selecting ? "" : HOVER_CLASS}`}
      >
        <span
          aria-hidden
          className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors duration-150 ${selected ? "octave-brand-fill border-transparent" : "border-content-tertiary bg-transparent"}`}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      </button>
  );
  return cell ? <div role="gridcell" className="flex items-center justify-center">{box}</div> : box;
});
