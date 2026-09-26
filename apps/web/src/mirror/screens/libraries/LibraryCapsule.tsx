import { memo, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { noMotion } from "../../../theme/motion";
import { CTL_GRADIENT } from "../../catalog/catalogOptions";

export interface CapsuleItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

/** Au-delà, la capsule défile : des segments de largeur fixe (128). */
const MAX_EVEN = 4;
const SCROLL_SEGMENT = 128;
/** Le ressort de l'indicateur (amorti 28, raideur 320, masse 0,8), en courbe CSS. */
const SLIDE = "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * La capsule des bibliothèques (`library/LibraryCapsule` de l'app) : pilule
 * de 48, 560 au plus (alignée sur le titre sur tablette), marge 16, liseré
 * `border.strong` sur `surface.s1`, 4 de marge intérieure. Un calque au
 * dégradé des contrôles glisse sous la bibliothèque choisie — seule une
 * translation s'anime ; il se pose sans glisser au premier rendu et quand le
 * mouvement est réduit. Segments : icône 15, libellé 14 semi-gras, écart 7.
 */
export const LibraryCapsule = memo(function LibraryCapsule({ items, selected, onSelect, label }: {
  items: CapsuleItem[];
  selected: string;
  onSelect: (id: string) => void;
  label: string;
}) {
  const scrolls = items.length > MAX_EVEN;
  const index = Math.max(0, items.findIndex((item) => item.id === selected));
  // Le premier placement ne glisse pas : l'indicateur arrive déjà en place.
  const [placed, setPlaced] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const choose = (id: string) => {
    if (id === selected) return;
    try {
      navigator.vibrate?.(5);
    } catch {
      /* pas de vibreur */
    }
    onSelect(id);
  };

  const pillStyle = scrolls
    ? { width: SCROLL_SEGMENT, transform: `translateX(${index * SCROLL_SEGMENT}px)` }
    : { width: `${100 / items.length}%`, transform: `translateX(${index * 100}%)` };

  const row = (
    <div className="relative flex h-full items-stretch" style={scrolls ? { width: SCROLL_SEGMENT * items.length } : { width: "100%" }}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
        style={{ ...pillStyle, background: CTL_GRADIENT, transition: placed && !noMotion() ? SLIDE : "none" }}
      />
      {items.map((item) => {
        const active = item.id === selected;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={item.label}
            onClick={() => choose(item.id)}
            className={`relative flex min-w-0 items-center justify-center gap-[7px] px-2 ${scrolls ? "shrink-0" : "flex-1"} ${
              active ? "text-cta-brand-fg" : "text-content-secondary"
            }`}
            style={scrolls ? { width: SCROLL_SEGMENT } : undefined}
          >
            <Icon size={15} aria-hidden className="shrink-0" />
            <span className="truncate text-sm font-semibold tracking-[0.1px]">{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      role="tablist"
      aria-label={label}
      className="mx-4 h-12 max-w-[560px] overflow-hidden rounded-full border border-line-strong bg-surface-1 p-1"
    >
      {scrolls ? <div className="mirror-no-scrollbar h-full overflow-x-auto">{row}</div> : row}
    </div>
  );
});
