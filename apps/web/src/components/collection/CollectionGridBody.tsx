import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { MediaItem } from "@tentacle-tv/shared";
import { CollectionGridCard } from "./CollectionGridCard";
import { useItemsPerRow } from "../../hooks/useItemsPerRow";
import type { SelectionMode } from "./selectionMode";

/** Mêmes constantes que la grille de bibliothèque — les deux doivent s'aligner. */
const GAP = 16;
const POSTER_ASPECT = 2 / 3;
/** Bloc titre : deux lignes plus la marge du haut. */
const TEXT_HEIGHT = 50;

interface CollectionGridBodyProps {
  items: MediaItem[];
  selectionMode?: SelectionMode;
  /**
   * Empreinte de tout ce qui précède la grille et peut en changer la hauteur.
   *
   * Une CHAÎNE, et non un tableau de dépendances : celui d'un `useEffect` doit
   * garder une taille constante d'un rendu à l'autre, ce qu'un tableau reçu en
   * prop ne garantit pas.
   */
  headerKey: string;
}

/**
 * Corps virtualisé des grilles Ma liste et Favoris.
 *
 * Reprend trait pour trait le patron de `LibraryGrid` — `useWindowVirtualizer`
 * par RANGÉE, colonnes par `useItemsPerRow`, `scrollMargin` recalculé quand
 * l'en-tête change de hauteur. Ces deux grilles 2:3 partagent maintenant leur
 * mécanique de défilement, à un endroit près : la bibliothèque pagine à l'infini,
 * une collection est entièrement chargée.
 *
 * Avant cela, la grille montait TOUT : trois cents titres en liste faisaient
 * trois cents cartes vivantes, chacune avec son image décodée (540 Ko), son
 * observateur d'intersection et ses abonnements au cache. `content-visibility`
 * n'élidait que leur peinture.
 *
 * ⚠️ `useItemsPerRow` donne 7 colonnes à 1440 px là où les paliers Tailwind
 * précédents en donnaient 6. C'est assumé : les deux grilles 2:3 de
 * l'application doivent compter leurs colonnes de la même façon.
 */
export function CollectionGridBody({ items, selectionMode, headerKey }: CollectionGridBodyProps) {
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);
  const { itemsPerRow, containerWidth } = useItemsPerRow(gridRef);

  const rowCount = Math.ceil(items.length / itemsPerRow);

  const estimateSize = useCallback(() => {
    if (containerWidth <= 0) return 320;
    const cardWidth = (containerWidth - GAP * (itemsPerRow - 1)) / itemsPerRow;
    return cardWidth / POSTER_ASPECT + TEXT_HEIGHT + GAP;
  }, [containerWidth, itemsPerRow]);

  // Le virtualiseur mesure depuis le haut de la FENÊTRE : il lui faut savoir de
  // combien la grille est décalée. L'en-tête et les onglets changent de hauteur
  // (deux lignes de filtres sur écran étroit), d'où le recalcul.
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    if (gridRef.current) setScrollMargin(gridRef.current.offsetTop);
  }, [headerKey]);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize,
    overscan: 5,
    scrollMargin,
  });

  const handleNavigate = useCallback((id: string) => navigate(`/media/${id}`), [navigate]);

  return (
    <div ref={gridRef}>
      {/* `row-dim` : ancre commune aux surfaces de cartes (cf. theme/cards.css et
          `boundsFor`), conservée comme sur la grille de bibliothèque. */}
      <div
        className="row-dim"
        style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          const start = row.index * itemsPerRow;
          return (
            <div
              key={row.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: row.size,
                transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <div
                className="grid"
                /* Même mécanisme que `LibraryGrid` : `colonnesTv.ts` publie la largeur
         et sonde le moteur, `grille-tv.css` pose l'écart.
         tv-compat-ok: traité par colonnesTv.ts + grille-tv.css */
      style={{ gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`, gap: GAP }}
              >
                {items.slice(start, start + itemsPerRow).map((item) => (
                  <CollectionGridCard
                    key={item.Id}
                    item={item}
                    onNavigate={handleNavigate}
                    selectionMode={selectionMode}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
