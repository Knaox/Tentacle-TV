import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { Spinner } from "../../components/ui/Spinner";
import { MediaCard } from "../cards/MediaCard";
import { MediaActionSheet } from "../cards/MediaActionSheet";
import type { CardSheetTarget } from "../cards/cardSheet";
import { useGrid } from "../useMirrorLayout";
import { ScrollTopFab } from "./ScrollTopFab";
import { CatalogEmpty } from "./CatalogGridStates";

/** Le bas de page approche : la page suivante part à une demi-hauteur d'écran (`onEndReachedThreshold` 0,5). */
const END_MARGIN = "0px 0px 50% 0px";

interface Props {
  items: MediaItem[];
  isLoading: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => unknown;
  /** Toucher une affiche — par défaut la fiche. */
  onItemPress?: (item: MediaItem) => void;
  /** Remplace l'état vide — `null` : rien (la place est déjà prise). */
  empty?: ReactNode | null;
  /** Une recherche ou un filtre resserre la grille : l'état vide propose de les lever. */
  filtered?: boolean;
  onReset?: () => void;
  /** Le squelette porte les deux lignes de légende (catalogue de bibliothèque). */
  captions?: boolean;
}

/**
 * La grille d'un catalogue (`catalog/CatalogGrid` de l'app) : 3 colonnes au
 * téléphone, carte cible de 150 sur tablette (`useGrid`), gouttière 8, 12
 * entre deux rangées, marges 16 ; affiches en petit (titre 11). La fenêtre
 * défile — pas de conteneur à ascenseur : l'en-tête de verre se replie comme
 * ailleurs. Au bas, la page suivante se charge (IntersectionObserver) avec un
 * anneau de marque ; au-delà d'un écran et demi, « Revenir en haut ».
 *
 * L'appui long ouvre la feuille d'actions de la carte (`MediaActionSheet`).
 */
export const CatalogGrid = memo(function CatalogGrid({
  items, isLoading, hasNextPage = false, isFetchingNextPage = false, fetchNextPage, onItemPress, empty,
  filtered = false, onReset, captions = false,
}: Props) {
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });
  const [sheet, setSheet] = useState<CardSheetTarget | null>(null);
  const openSheet = useCallback((item: MediaItem) => setSheet({ kind: "media", variant: "poster", item }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  // Le rappel du bas de page lit toujours l'état courant, sans réabonner l'observateur.
  const more = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage });
  more.current = { hasNextPage, isFetchingNextPage, fetchNextPage };
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const m = more.current;
        if (entries[entries.length - 1].isIntersecting && m.hasNextPage && !m.isFetchingNextPage) m.fetchNextPage?.();
      },
      { rootMargin: END_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  if (isLoading && items.length === 0) return <GridSkeleton rows={captions ? 3 : 2} captions={captions} />;

  if (items.length === 0) {
    if (empty !== undefined) return <>{empty}</>;
    return <CatalogEmpty filtered={filtered} onReset={onReset} />;
  }

  return (
    <>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${numColumns}, ${itemWidth}px)`,
          columnGap: gutter,
          rowGap: 12,
          paddingLeft: padding,
          paddingRight: padding,
        }}
      >
        {items.map((item) => (
          <GridCell key={item.Id} item={item} width={itemWidth} onPress={onItemPress} onLongPress={openSheet} />
        ))}
      </div>
      <div ref={sentinel} aria-hidden className="h-px" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-5">
          <Spinner size="sm" />
        </div>
      )}
      <ScrollTopFab />
      <MediaActionSheet target={sheet} onClose={closeSheet} />
    </>
  );
});

/** Une cellule : la carte mémoïsée, ses rappels liés à l'item. */
const GridCell = memo(function GridCell({ item, width, onPress, onLongPress }: {
  item: MediaItem;
  width: number;
  onPress?: (item: MediaItem) => void;
  onLongPress: (item: MediaItem) => void;
}) {
  return (
    <MediaCard
      item={item}
      width={width}
      small
      onPress={onPress ? () => onPress(item) : undefined}
      onLongPress={() => onLongPress(item)}
    />
  );
});

/**
 * Le squelette de la grille : des rangées d'affiches 2:3 au rayon 12 — avec,
 * pour un catalogue, les deux lignes de légende de la vraie carte.
 */
export function GridSkeleton({ rows = 2, captions = false }: { rows?: number; captions?: boolean }) {
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });
  return (
    <div
      className="grid"
      aria-hidden
      style={{ gridTemplateColumns: `repeat(${numColumns}, ${itemWidth}px)`, gap: gutter, paddingLeft: padding, paddingRight: padding }}
    >
      {Array.from({ length: numColumns * rows }, (_, i) => captions ? (
        <div key={i} className="mb-1 flex flex-col gap-1.5" style={{ width: itemWidth }}>
          <div className="skeleton-shimmer rounded-xl" style={{ height: itemWidth * 1.5 }} />
          <div className="skeleton-shimmer h-2.5 w-3/4 rounded-full" />
          <div className="skeleton-shimmer h-2 w-1/3 rounded-full" />
        </div>
      ) : (
        <div key={i} className="skeleton-shimmer rounded-xl" style={{ width: itemWidth, height: itemWidth * 1.5 }} />
      ))}
    </div>
  );
}
