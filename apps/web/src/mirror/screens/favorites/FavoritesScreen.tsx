import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { groupFavorites, summarizeFavorites, useBatchRemoveFavorites, useFavoritesAll } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMultiSelect } from "../../../hooks/useMultiSelect";
import { useFavoritesGroupMode } from "../../../components/favorites/useFavoritesGroupMode";
import { MediaActionSheet } from "../../cards/MediaActionSheet";
import { GridSkeleton, ScopedSearchEmpty, ScrollTopFab, useBackOrHome } from "../../catalog";
import { CollectionFilterHeader } from "../collection/CollectionFilterHeader";
import { ListHeader } from "../collection/ListHeader";
import { SelectionBar } from "../collection/SelectionBar";
import { useCollectionFilters } from "../collection/useCollectionFilters";
import { FavoritesEmptyState } from "./FavoritesEmptyState";
import { FavoritesGrid } from "./FavoritesGrid";
import { FavoritesQuickRow } from "./FavoritesQuickRow";
import "../../mirror.css";

/**
 * Route `/favorites` du miroir — Mes favoris (`screens/FavoritesScreen` de
 * l'app) : l'en-tête et la barre de filtres de Ma liste, puis les tuiles
 * d'état et « Regrouper », et la grille, plate ou en sections repliables.
 * Toucher ouvre la fiche — ou coche, en sélection ; l'appui long ouvre la
 * feuille d'actions. En sélection, filtres et tuiles s'effacent devant la
 * barre du bas. Le regroupement est celui du bureau (`?group=`, retenu par
 * le navigateur).
 */
export function MirrorFavorites() {
  const { t } = useTranslation(["common", "favorites"]);
  const navigate = useNavigate();
  const back = useBackOrHome();
  const { data: raw, isLoading } = useFavoritesAll();
  const batchRemove = useBatchRemoveFavorites();
  const filters = useCollectionFilters(raw);
  const data = filters.filtered;
  const { mode, setMode } = useFavoritesGroupMode();
  const groups = useMemo(() => groupFavorites(data, mode), [data, mode]);
  const summary = useMemo(() => summarizeFavorites(raw ?? []), [raw]);
  const selection = useMultiSelect();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const closeSheet = useCallback(() => setSheetId(null), []);

  const handlePress = useCallback((item: MediaItem) => {
    if (selection.isSelecting) selection.toggle(item.Id);
    else navigate(`/media/${item.Id}`);
  }, [navigate, selection]);
  const handleLongPress = useCallback((item: MediaItem) => {
    if (!selection.isSelecting) setSheetId(item.Id);
  }, [selection.isSelecting]);
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
  const hours = Math.floor(summary.movieMinutes / 60);
  const subtitle = isLoading || totalRaw === 0
    ? ""
    : [t("itemCount", { count }), hours > 0 ? t("favorites:summaryMovieHours", { count: hours }) : null].filter(Boolean).join(" · ");

  let body: ReactNode;
  if (isLoading) {
    body = <GridSkeleton rows={3} />;
  } else if (totalRaw === 0) {
    body = <FavoritesEmptyState />;
  } else if (count === 0) {
    // Filtrée à zéro : lever les filtres ; une RECHERCHE sans réponse : la bonne orthographe.
    body = filters.state.search.length >= 2 ? (
      <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} />
    ) : (
      <div className="flex flex-col items-center gap-2 px-4 pb-5 pt-16">
        <Heart size={40} className="text-brand-light opacity-60" aria-hidden />
        <p className="mt-3 text-lg font-bold tracking-[-0.3px] text-content-primary">{t("noResults")}</p>
        <p className="max-w-[280px] text-center text-[13px] text-content-tertiary">{t("noResultsHint")}</p>
        <button type="button" onClick={() => { filters.reset(); filters.patch({ type: "all" }); }} className="mt-3 min-h-[44px] rounded-full px-5 text-sm font-semibold text-brand-light" style={{ background: "var(--brand-soft)" }}>
          {t("resetFilters")}
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <FavoritesGrid
          groups={groups}
          isSelecting={selection.isSelecting}
          selected={selection.selected}
          onPress={handlePress}
          onLongPress={handleLongPress}
        />
        {!selection.isSelecting && <ScrollTopFab />}
      </>
    );
  }

  const showControls = !selection.isSelecting && !isLoading && totalRaw > 0;

  return (
    <div>
      <ListHeader
        title={t("myFavorites")}
        subtitle={subtitle}
        Icon={Heart}
        onBack={back}
        onEnterSelection={selection.enterSelectionMode}
        canSelect={count > 0 && !selection.isSelecting}
      />
      {showControls && <CollectionFilterHeader filters={filters} />}
      {showControls && (
        <FavoritesQuickRow
          items={raw ?? []}
          type={filters.state.type}
          status={filters.state.statusFilter}
          onStatusChange={(statusFilter) => filters.patch({ statusFilter })}
          groupMode={mode}
          onGroupModeChange={setMode}
        />
      )}
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
