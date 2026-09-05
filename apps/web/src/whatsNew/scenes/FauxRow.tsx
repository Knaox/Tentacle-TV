import type { ReactNode } from "react";
import { posterAt, useSceneMedia } from "../sceneMedia";
import { FauxCard } from "./FauxCard";
import { Place, type Animated, type Placed } from "./Place";
import { sceneSpring } from "./sceneMotion";

interface FauxRowProps extends Placed, Animated {
  /** Le vrai libellé de la rangée (i18n). */
  title: string;
  count?: number;
  cardW?: number;
  gap?: number;
  /** Décalage dans la liste des affiches : deux rangées ne montrent pas les mêmes. */
  offset?: number;
  /** Titre + année sous chaque affiche, comme sur l'accueil. */
  showTitles?: boolean;
  /** Cartes masquées par un FILTRE : les suivantes glissent pour refermer le trou. */
  hidden?: readonly number[];
  /** Cartes pas encore apparues : invisibles À LEUR PLACE, sans décalage (défaut : apparues). */
  revealed?: boolean;
  /** Carte survolée. */
  highlight?: number;
  /** Les cartes apparaissent l'une après l'autre quand la rangée se révèle. */
  stagger?: boolean;
  /** Après le titre : une puce de filtre, par exemple. */
  after?: ReactNode;
}

/** Hauteur du bloc titre de `PosterCard` : marge, titre, année. */
const TITLE_BLOCK = 48;

/** Une rangée de l'accueil, avec de vraies affiches. */
export function FauxRow({
  title, count = 5, cardW = 72, gap = 10, offset = 0, showTitles = false, hidden = [], revealed = true, highlight,
  stagger = false, after, w, visible = true, ...place
}: FauxRowProps) {
  const media = useSceneMedia();
  const pitch = cardW + gap;
  const width = w ?? count * cardW + (count - 1) * gap;
  const shown = visible && revealed;
  return (
    <Place {...place} w={width} visible={visible}>
      <div className="mb-2 flex h-5 min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-[15px] font-semibold leading-none tracking-tight text-content-primary">{title}</span>
        {after}
      </div>
      <div className="relative" style={{ height: Math.round(cardW * 1.5) + (showTitles ? TITLE_BLOCK : 0) }}>
        {Array.from({ length: count }, (_, i) => {
          const isHidden = hidden.includes(i);
          const shift = hidden.filter((idx) => idx < i).length;
          return (
            <FauxCard
              key={i}
              x={i * pitch}
              y={0}
              w={cardW}
              poster={posterAt(media, offset + i)}
              tone={(offset + i) % 6}
              showTitle={showTitles}
              visible={shown && !isHidden}
              dx={-shift * pitch}
              dy={shown ? 0 : 10}
              hovered={highlight === i}
              transition={{ ...sceneSpring, delay: stagger && shown && !isHidden ? i * 0.07 : 0 }}
            />
          );
        })}
      </div>
    </Place>
  );
}
