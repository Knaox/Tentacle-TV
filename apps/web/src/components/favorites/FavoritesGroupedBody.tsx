import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { FavoritesGroup } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { CollectionGridCard } from "../collection/CollectionGridCard";
import type { SelectionMode } from "../collection/selectionMode";
import { useItemsPerRow } from "../../hooks/useItemsPerRow";
import { FavoritesSectionHeader, useFavoritesGroupTitle } from "./FavoritesSectionHeader";

/** Mêmes constantes que `CollectionGridBody` : les deux grilles doivent s'aligner. */
const GAP = 16;
const POSTER_ASPECT = 2 / 3;
const TEXT_HEIGHT = 52;
const HEADER_HEIGHT = 64;

type Row =
  | { kind: "header"; group: FavoritesGroup; collapsed: boolean; first: boolean }
  | { kind: "cards"; groupKey: string; items: MediaItem[] };

interface FavoritesGroupedBodyProps {
  groups: FavoritesGroup[];
  selectionMode?: SelectionMode;
  /** Empreinte de ce qui précède la grille — cf. `CollectionGridBody`. */
  headerKey: string;
}

/**
 * La grille de Mes favoris, découpée en sections repliables.
 *
 * Le patron de `CollectionGridBody` — virtualiseur de FENÊTRE par rangée,
 * colonnes par `useItemsPerRow`, rangées mesurées — sur une liste mixte : une
 * rangée d'en-tête par section, puis ses rangées d'affiches. Trois cents titres
 * regroupés ne montent donc toujours que ce qui est à l'écran. La carte est
 * `CollectionGridCard`, telle quelle : sélection, menu contextuel et actions
 * rapides viennent avec elle.
 */
export function FavoritesGroupedBody({ groups, selectionMode, headerKey }: FavoritesGroupedBodyProps) {
  const navigate = useNavigate();
  const title = useFavoritesGroupTitle();
  const gridRef = useRef<HTMLDivElement>(null);
  const { itemsPerRow, containerWidth } = useItemsPerRow(gridRef);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const rows = useMemo(() => {
    const out: Row[] = [];
    groups.forEach((group, gi) => {
      const isCollapsed = collapsed.has(group.key);
      out.push({ kind: "header", group, collapsed: isCollapsed, first: gi === 0 });
      if (isCollapsed) return;
      for (let i = 0; i < group.items.length; i += itemsPerRow) {
        out.push({ kind: "cards", groupKey: group.key, items: group.items.slice(i, i + itemsPerRow) });
      }
    });
    return out;
  }, [groups, collapsed, itemsPerRow]);

  const estimateSize = useCallback(
    (index: number) => {
      if (rows[index]?.kind === "header") return HEADER_HEIGHT;
      if (containerWidth <= 0) return 320;
      const cardWidth = (containerWidth - GAP * (itemsPerRow - 1)) / itemsPerRow;
      return cardWidth / POSTER_ASPECT + TEXT_HEIGHT + GAP;
    },
    [rows, containerWidth, itemsPerRow],
  );

  // Distance au haut du DOCUMENT, pas `offsetTop` : la grille vit dans un
  // conteneur positionné (sous la bannière), et `offsetTop` ne compterait que
  // depuis lui — la fenêtre de rendu du virtualiseur glisserait alors de la
  // hauteur de la bannière, ce que l'overscan ne couvre plus quand les
  // sections repliées ne laissent que des en-têtes de 64 px. Relue aussi quand
  // la largeur change : le dock au-dessus change de hauteur en se repliant.
  const [scrollMargin, setScrollMargin] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (el) setScrollMargin(Math.round(el.getBoundingClientRect().top + window.scrollY));
  }, [headerKey, containerWidth]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize,
    overscan: 3,
    scrollMargin,
    getItemKey: (index) => {
      const row = rows[index];
      return row.kind === "header" ? `h:${row.group.key}` : `c:${row.groupKey}:${row.items[0]?.Id}`;
    },
  });

  const handleNavigate = useCallback((id: string) => navigate(`/media/${id}`), [navigate]);

  return (
    <div ref={gridRef}>
      <div className="row-dim" style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((v) => {
          const row = rows[v.index];
          return (
            <div
              key={v.key}
              ref={virtualizer.measureElement}
              data-index={v.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                paddingBottom: row.kind === "cards" ? GAP : 0,
                transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {row.kind === "header" ? (
                <FavoritesSectionHeader
                  title={title(row.group)}
                  count={row.group.items.length}
                  collapsed={row.collapsed}
                  first={row.first}
                  onToggle={() => toggle(row.group.key)}
                />
              ) : (
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`, gap: GAP }}
                >
                  {row.items.map((item) => (
                    <CollectionGridCard key={item.Id} item={item} onNavigate={handleNavigate} selectionMode={selectionMode} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
