import { useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Folder } from "lucide-react";
import { useLibraries } from "@tentacle-tv/api-client";
import type { LibraryView, MediaItem } from "@tentacle-tv/shared";
import {
  CatalogFilterSheet,
  CatalogGrid,
  FilterButton,
  GridSkeleton,
  LibraryFilterBar,
  ScopedSearchEmpty,
  ScopedSearchField,
  useLibraryCatalogState,
} from "../../catalog";
import { LibraryCapsule } from "./LibraryCapsule";
import { LIBRARY_HERO_HEIGHT, LibraryHero, collectionIcon } from "./LibraryHero";
import "../../mirror.css";

/** La bibliothèque choisie survit au changement d'onglet (le temps de la session). */
let lastLibraryId: string | null = null;

/**
 * L'onglet Bibliothèque (`screens/LibrariesScreen` de l'app) : on arrive DANS
 * la dernière bibliothèque ouverte, la capsule passe de Films à Séries d'un
 * geste, et l'ambiance change avec elle. Tout défile d'un seul tenant —
 * héros, capsule, recherche, filtres, grille — et replie le chrome.
 *
 * La bibliothèque choisie vit aussi dans l'adresse (`?lib=`) : un retour
 * depuis une fiche la retrouve, un lien la partage.
 */
export function LibrariesScreen() {
  const { t } = useTranslation("common");
  const { data, isLoading } = useLibraries();
  const [params, setParams] = useSearchParams();
  const libraries = useMemo(() => data ?? [], [data]);
  const wanted = params.get("lib") ?? lastLibraryId;
  const current = libraries.find((lib) => lib.Id === wanted) ?? libraries[0] ?? null;

  const select = useCallback((id: string) => {
    lastLibraryId = id;
    // La nouvelle bibliothèque s'ouvre en haut : garder la position d'une autre grille n'aurait aucun sens.
    window.scrollTo({ top: 0 });
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("lib", id);
      return next;
    }, { replace: true });
  }, [setParams]);

  if (isLoading) return <LibrariesSkeleton />;
  if (!current) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Folder size={48} className="text-brand-light opacity-60" aria-hidden />
        <p className="text-center text-[15px] font-medium text-content-tertiary">{t("noResults")}</p>
      </div>
    );
  }
  return <LibraryTab libraries={libraries} current={current} onSelect={select} />;
}

function LibraryTab({ libraries, current, onSelect }: {
  libraries: LibraryView[];
  current: LibraryView;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const state = useLibraryCatalogState(current.Id);
  const { catalog, searching, totalCount, setSheetOpen } = state;
  const emptySearch = searching && !catalog.isLoading && totalCount === 0;

  const capsuleItems = useMemo(
    () => libraries.map((lib) => ({ id: lib.Id, label: lib.Name, icon: collectionIcon(lib.CollectionType) })),
    [libraries],
  );
  const openItem = useCallback((item: MediaItem) => navigate(`/media/${item.Id}`), [navigate]);
  const openSheet = useCallback(() => setSheetOpen(true), [setSheetOpen]);

  return (
    <div>
      <LibraryHero library={current} />
      <LibraryCapsule items={capsuleItems} selected={current.Id} onSelect={onSelect} label={t("librariesTitle")} />
      <div className="mb-2 mt-3 flex items-center gap-2 px-4">
        <ScopedSearchField
          value={state.searchQuery}
          onChange={state.setSearchQuery}
          placeholder={t("searchInLibrary", { name: current.Name })}
          count={searching && !catalog.isLoading ? totalCount : null}
          inset={false}
        />
        <FilterButton count={state.filterCount} onPress={openSheet} />
      </div>
      {/* Le total est déjà sous le titre : le compte ne revient qu'avec un filtre. */}
      <LibraryFilterBar state={state} showCount={state.isFiltered} />
      {emptySearch && <ScopedSearchEmpty query={state.debouncedSearch} onApply={state.setSearchQuery} />}
      <CatalogGrid
        items={emptySearch ? [] : state.items}
        isLoading={catalog.isLoading}
        hasNextPage={catalog.hasNextPage}
        isFetchingNextPage={catalog.isFetchingNextPage}
        fetchNextPage={catalog.fetchNextPage}
        onItemPress={openItem}
        empty={emptySearch ? null : undefined}
      />
      <CatalogFilterSheet state={state} />
    </div>
  );
}

/** Le squelette de l'onglet : titre 180×40, capsule 48, deux rangées d'affiches. */
function LibrariesSkeleton() {
  return (
    <div aria-hidden style={{ paddingTop: LIBRARY_HERO_HEIGHT - 80 }}>
      <div className="mx-4 mb-4 h-10 w-[180px] rounded-lg bg-fill-subtle" />
      <div className="mx-4 mb-4 h-12 max-w-[560px] rounded-full bg-fill-subtle" />
      <GridSkeleton />
    </div>
  );
}
