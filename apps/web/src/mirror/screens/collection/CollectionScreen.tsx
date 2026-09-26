import { useCallback, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, type MediaItem } from "@tentacle-tv/shared";
import { useMultiSelect } from "../../../hooks/useMultiSelect";
import { MediaActionSheet } from "../../cards/MediaActionSheet";
import { GridSkeleton, ScopedSearchEmpty, ScrollTopFab, useBackOrHome } from "../../catalog";
import { useGrid } from "../../useMirrorLayout";
import { CollectionFilterHeader } from "./CollectionFilterHeader";
import { ListHeader } from "./ListHeader";
import { SelectableGridCard } from "./SelectableGridCard";
import { SelectionBar } from "./SelectionBar";
import { useCollectionFilters } from "./useCollectionFilters";
import "../../mirror.css";

export interface CollectionScreenProps {
  /** La source : `useWatchlistAll` ou `useFavoritesAll`, déjà appelée. */
  query: { data: MediaItem[] | undefined; isLoading: boolean };
  /** Suppression en lot, déjà appelée par l'écran appelant. */
  batchRemove: { mutateAsync: (ids: string[]) => Promise<unknown>; isPending: boolean };
  title: string;
  Icon: LucideIcon;
  emptyTitle: string;
  emptyHint: string;
  /** Bouton propre à la page — le partage de Ma liste. */
  action?: ReactNode;
}

/**
 * Ma liste et Mes favoris — UN seul écran (`screens/collection/CollectionScreen`
 * de l'app) : en-tête, partage, barre de filtres, grille (3 colonnes au
 * téléphone, `useGrid` sur tablette, gouttière 8, 12 entre rangées). Toucher
 * ouvre la fiche — ou coche, en sélection ; l'appui long ouvre la feuille
 * d'actions. En sélection, les filtres s'effacent devant la barre du bas.
 */
export function CollectionScreen({ query, batchRemove, title, Icon, emptyTitle, emptyHint, action }: CollectionScreenProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const back = useBackOrHome();
  const client = useJellyfinClient();
  const { data: raw, isLoading } = query;
  const filters = useCollectionFilters(raw);
  const data = filters.filtered;
  const selection = useMultiSelect();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSheetId(null), []);
  const { numColumns, itemWidth, gutter, padding } = useGrid({ phoneColumns: 3 });

  const handlePress = (item: MediaItem) => {
    if (selection.isSelecting) selection.toggle(item.Id);
    else navigate(`/media/${item.Id}`);
  };
  const handleLongPress = (item: MediaItem) => {
    if (!selection.isSelecting) setSheetId(item.Id);
  };
  const handleDelete = async () => {
    const ids = [...selection.selected];
    if (ids.length === 0) return;
    await batchRemove.mutateAsync(ids);
    selection.exitSelectionMode();
  };
  // « Tout sélectionner » porte sur ce qui est FILTRÉ : c'est ce que l'écran montre.
  const handleSelectAll = () => {
    if (selection.count === data.length) selection.selectAll([]);
    else selection.selectAll(data.map((i) => i.Id));
  };

  const count = data.length;
  const totalRaw = raw?.length ?? 0;
  const subtitle = isLoading ? "" : count === 0 ? emptyHint : t("itemCount", { count });

  let body: ReactNode;
  if (isLoading) {
    body = <GridSkeleton rows={3} />;
  } else if (count === 0) {
    // Une collection VIDE invite à ajouter ; filtrée à zéro, elle propose de
    // lever les filtres ; une RECHERCHE sans réponse, la bonne orthographe.
    body = totalRaw > 0 && filters.state.search.length >= 2 ? (
      <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} />
    ) : (
      <div className="flex flex-col items-center gap-2 px-4 pb-5 pt-20">
        <Icon size={48} className="text-brand-light opacity-60" aria-hidden />
        <p className="mt-3 text-lg font-bold tracking-[-0.3px] text-content-primary">{totalRaw > 0 ? t("noResults") : emptyTitle}</p>
        <p className="max-w-[280px] text-center text-[13px] text-content-tertiary">{totalRaw > 0 ? t("noResultsHint") : emptyHint}</p>
      </div>
    );
  } else {
    body = (
      <>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${numColumns}, ${itemWidth}px)`,
            columnGap: gutter,
            rowGap: 12,
            paddingLeft: padding,
            paddingRight: padding,
            // En sélection, la fin de la grille dépasse la barre flottante.
            paddingBottom: selection.isSelecting ? 132 : 0,
          }}
        >
          {data.map((item) => (
            <SelectableGridCard
              key={item.Id}
              posterUri={client.getImageUrl(item.Id, "Primary", { width: 300, quality: 80 })}
              title={item.Name}
              year={item.ProductionYear ?? null}
              progressPercent={item.UserData?.PlayedPercentage ?? null}
              watched={item.UserData?.Played === true}
              rating={cardRatingFor(item, "series").rating}
              width={itemWidth}
              selectable={selection.isSelecting}
              selected={selection.selected.has(item.Id)}
              onPress={() => handlePress(item)}
              onLongPress={() => handleLongPress(item)}
            />
          ))}
        </div>
        {!selection.isSelecting && <ScrollTopFab />}
      </>
    );
  }

  return (
    <div>
      <ListHeader
        title={title}
        subtitle={subtitle}
        Icon={Icon}
        onBack={back}
        onEnterSelection={selection.enterSelectionMode}
        canSelect={count > 0 && !selection.isSelecting}
      />
      {!selection.isSelecting && action && <div className="flex px-4 pb-2">{action}</div>}
      {/* Masqués en sélection, et sur une collection vraiment vide : rien à trier. */}
      {!selection.isSelecting && !isLoading && totalRaw > 0 && <CollectionFilterHeader filters={filters} />}
      {body}
      <MediaActionSheet itemId={sheetId} onClose={closeSheet} />
      {selection.isSelecting && (
        <SelectionBar
          count={selection.count}
          totalCount={count}
          onSelectAll={handleSelectAll}
          onDelete={() => void handleDelete()}
          onCancel={selection.exitSelectionMode}
          busy={batchRemove.isPending}
        />
      )}
    </div>
  );
}
