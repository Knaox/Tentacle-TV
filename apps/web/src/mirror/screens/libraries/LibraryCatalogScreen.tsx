import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Search, SlidersHorizontal } from "lucide-react";
import { useLibraries } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import {
  CatalogFilterSheet,
  CatalogGrid,
  LibraryFilterBar,
  ScopedSearchEmpty,
  ScopedSearchField,
  useBackOrHome,
  useLibraryCatalogState,
} from "../../catalog";
import "../../mirror.css";

/**
 * Une bibliothèque ouverte depuis ailleurs (`screens/LibraryCatalogScreen`
 * de l'app, route `library/[libraryId]`) : en-tête avec retour (chevron 26),
 * titre 22 extra-gras, loupe et filtres (icônes 20, pastille de 15) ; la
 * recherche se déplie dessous ; pastilles de filtre ; grille infinie. Son
 * état est celui de l'onglet Bibliothèque (`useLibraryCatalogState`).
 */
export function LibraryCatalogScreen({ libraryId }: { libraryId: string }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const back = useBackOrHome();
  const libraryName = useLibraries().data?.find((lib) => lib.Id === libraryId)?.Name ?? "";
  const state = useLibraryCatalogState(libraryId);
  const { catalog, searching, totalCount, setSearchQuery, setSheetOpen } = state;
  const [searchVisible, setSearchVisible] = useState(false);
  const emptySearch = searching && !catalog.isLoading && totalCount === 0;

  const openItem = useCallback((item: MediaItem) => navigate(`/media/${item.Id}`), [navigate]);
  // Replier la barre, c'est aussi lever le filtre — jamais une grille filtrée en douce.
  const toggleSearch = () => {
    if (searchVisible) setSearchQuery("");
    setSearchVisible(!searchVisible);
  };
  const active = state.filterCount > 0;

  return (
    <div>
      <div className="flex items-center gap-1 px-4 py-2">
        <button type="button" onClick={back} aria-label={t("back")} className="mr-1 p-1 text-content-primary">
          <ChevronLeft size={26} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-[-0.4px] text-content-primary">{libraryName}</h1>
        <div className="flex items-center">
          <button
            type="button"
            onClick={toggleSearch}
            aria-label={t("search")}
            aria-pressed={searchVisible}
            className={`p-1 ${searchVisible ? "" : "text-content-secondary"}`}
            style={searchVisible ? { color: "var(--brand)" } : undefined}
          >
            <Search size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={t("filters")}
            className={`relative ml-3 p-1 ${active ? "" : "text-content-secondary"}`}
            style={active ? { color: "var(--brand)" } : undefined}
          >
            <SlidersHorizontal size={20} aria-hidden />
            {active && (
              <span
                className="absolute -right-0.5 top-0 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px] font-extrabold text-cta-brand-fg"
                style={{ background: "var(--brand)" }}
              >
                {state.filterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {searchVisible && (
        <div className="mb-2">
          <ScopedSearchField
            value={state.searchQuery}
            onChange={setSearchQuery}
            placeholder={t("searchInLibrary", { name: libraryName })}
            count={searching && !catalog.isLoading ? totalCount : null}
            autoFocus
          />
        </div>
      )}

      <LibraryFilterBar state={state} />
      {/* Rien trouvé : la bonne orthographe et toute la recherche — jamais une grille vide. */}
      {emptySearch ? (
        <ScopedSearchEmpty query={state.debouncedSearch} onApply={setSearchQuery} />
      ) : (
        <CatalogGrid
          items={state.items}
          isLoading={catalog.isLoading}
          hasNextPage={catalog.hasNextPage}
          isFetchingNextPage={catalog.isFetchingNextPage}
          fetchNextPage={catalog.fetchNextPage}
          onItemPress={openItem}
        />
      )}
      <CatalogFilterSheet state={state} />
    </div>
  );
}
