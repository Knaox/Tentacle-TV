import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckSquare, Heart } from "lucide-react";
import { groupFavorites, summarizeFavorites, useBatchRemoveFavorites, useFavoritesAll } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMultiSelect } from "../../../hooks/useMultiSelect";
import { useFavoritesGroupMode } from "../../../components/favorites/useFavoritesGroupMode";
import { MediaActionSheet } from "../../cards/MediaActionSheet";
import type { CardSheetTarget } from "../../cards/cardSheet";
import { GridSkeleton, ScopedSearchEmpty, ScrollTopFab, useBackOrHome } from "../../catalog";
import { CatalogEmpty } from "../../catalog/CatalogGridStates";
import { CollectionControls, QuickChip } from "../collection/CollectionControls";
import { CollectionHero } from "../collection/CollectionHero";
import { ShareMyListButton } from "../collection/ShareMyListButton";
import { SelectionBar } from "../collection/SelectionBar";
import { useCollectionFilters } from "../collection/useCollectionFilters";
import { FavoritesEmptyState } from "./FavoritesEmptyState";
import { FavoritesGrid } from "./FavoritesGrid";
import { FavoritesQuickRow } from "./FavoritesQuickRow";
import "../../mirror.css";

/**
 * Route `/favorites` du miroir — Mes favoris (`screens/FavoritesScreen` de
 * l'app), À LA FORME de la Bibliothèque et de Ma liste : l'ambiance et le
 * retour flottant, le titre et son bilan, Partager et Sélectionner dessous ;
 * le champ, « Trier et filtrer » et la barre rapide ; puis ce qui n'appartient
 * qu'aux favoris — les tuiles d'état et « Regrouper » — et la grille, plate
 * ou en sections repliables.
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
  const [sheet, setSheet] = useState<CardSheetTarget | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);

  const handlePress = useCallback((item: MediaItem) => {
    if (selection.isSelecting) selection.toggle(item.Id);
    else navigate(`/media/${item.Id}`);
  }, [navigate, selection]);
  const handleLongPress = useCallback((item: MediaItem) => {
    if (!selection.isSelecting) setSheet({ kind: "media", variant: "poster", item });
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
    : [t("itemCount", { count: summary.total }), hours > 0 ? t("favorites:summaryMovieHours", { count: hours }) : null].filter(Boolean).join(" · ");

  let body: ReactNode;
  if (isLoading) {
    body = <GridSkeleton rows={3} captions />;
  } else if (totalRaw === 0) {
    body = <FavoritesEmptyState />;
  } else if (count === 0) {
    // Filtrée à zéro : lever les filtres ; une RECHERCHE sans réponse : la bonne orthographe.
    body = filters.state.search.length >= 2 ? (
      <ScopedSearchEmpty query={filters.state.search} onApply={filters.setInput} />
    ) : (
      <CatalogEmpty filtered onReset={() => { filters.reset(); filters.patch({ type: "all" }); }} />
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
      {/* Toujours là, même vide : il porte le retour. */}
      <CollectionHero
        items={raw}
        title={t("myFavorites")}
        kicker={t("favorites:kicker")}
        Icon={Heart}
        subtitle={subtitle}
        onBack={back}
        actions={!isLoading && totalRaw > 0 && !selection.isSelecting ? (
          <>
            <ShareMyListButton kind="likes" />
            {count > 0 && (
              <QuickChip onClick={selection.enterSelectionMode}>
                <CheckSquare size={14} aria-hidden className="text-brand-light" />
                {t("select")}
              </QuickChip>
            )}
          </>
        ) : undefined}
      />
      {showControls && <CollectionControls filters={filters} name={t("myFavorites")} />}
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
      <MediaActionSheet target={sheet} onClose={closeSheet} />
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
