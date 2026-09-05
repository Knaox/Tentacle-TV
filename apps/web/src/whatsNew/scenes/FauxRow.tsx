import type { ReactNode } from "react";
import { FauxCard } from "./FauxCard";
import { Place, type Animated, type Placed } from "./Place";
import { sceneSpring } from "./sceneMotion";

interface FauxRowProps extends Placed, Animated {
  /** Le vrai libellé de la rangée (i18n) — pas une barre grise. */
  title: string;
  count?: number;
  cardW?: number;
  gap?: number;
  /** Cartes masquées : les suivantes glissent pour refermer le trou. */
  hidden?: readonly number[];
  /** Carte soulevée. */
  highlight?: number;
  tones?: readonly number[];
  /** Les cartes apparaissent l'une après l'autre quand la rangée devient visible. */
  stagger?: boolean;
  /** Après le titre : une puce de filtre, par exemple. */
  after?: ReactNode;
}

/** Une rangée de fausses cartes sous son titre, façon accueil. */
export function FauxRow({
  title, count = 5, cardW = 72, gap = 10, hidden = [], highlight, tones, stagger = false, after,
  w, visible = true, ...place
}: FauxRowProps) {
  const pitch = cardW + gap;
  const width = w ?? count * cardW + (count - 1) * gap;
  return (
    <Place {...place} w={width} visible={visible}>
      <div className="mb-2 flex h-5 items-center gap-2">
        <span className="text-[13px] font-semibold leading-none text-content-primary">{title}</span>
        {after}
      </div>
      <div className="relative" style={{ height: Math.round(cardW * 1.5) }}>
        {Array.from({ length: count }, (_, i) => {
          const isHidden = hidden.includes(i);
          const shift = hidden.filter((idx) => idx < i).length;
          return (
            <FauxCard
              key={i}
              x={i * pitch}
              y={0}
              w={cardW}
              tone={tones?.[i] ?? i % 6}
              visible={visible && !isHidden}
              dx={-shift * pitch}
              dy={visible ? 0 : 10}
              lifted={highlight === i}
              transition={{ ...sceneSpring, delay: stagger && visible && !isHidden ? i * 0.07 : 0 }}
            />
          );
        })}
      </div>
    </Place>
  );
}
