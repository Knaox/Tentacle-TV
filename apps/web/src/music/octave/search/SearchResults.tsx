/**
 * Octave — les résultats MONTRÉS d'une recherche validée (`useRevealedResults`), façon Apple Music : les puces
 * Tout · Titres · Albums · Artistes · Playlists, puis la vue « Tout » (meilleur résultat, titres à côté, sections)
 * ou celle d'un filtre (`SearchKindView`). La mise en page est une règle pure (`searchLayout`) : la bibliothèque
 * gagne sur ses jumeaux, rien n'est montré deux fois, rien ne se réordonne une fois montré ; une extension en
 * retard garde sa place (rangées fantômes) au lieu de pousser la page en arrivant. Ce que la bibliothèque a parmi
 * les résultats de l'extension est montré comme le sien, marqué (`useOwnedLists`).
 */

import { memo, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/ViewStates";
import { SearchAllView } from "./SearchAllView";
import { SearchFilters } from "./SearchFilters";
import { SearchKindView } from "./SearchKindView";
import { useOwnedLists } from "./ownedSearch";
import { isEmptyLayout, layoutSearch, type SearchFilter } from "./searchLayout";
import { useKindResults } from "./useKindResults";
import type { useRevealedResults } from "./useRevealedResults";

type Revealed = ReturnType<typeof useRevealedResults>;

interface SearchResultsProps {
  results: Revealed;
  filter: SearchFilter;
  onFilter: (filter: SearchFilter) => void;
}

export const SearchResults = memo(function SearchResults({ results, filter, onFilter }: SearchResultsProps) {
  const { t } = useTranslation("music");
  const panelId = useId();
  const { library, external, externalPending } = results;
  const data = library?.data ?? null;
  const query = library?.query ?? "";
  const owned = useOwnedLists(external);
  const layout = useMemo(() => layoutSearch(data, owned.lists), [data, owned.lists]);
  const kind = useKindResults(query, filter, external);
  const ownedKind = useOwnedLists(kind.lists);
  if (!library) return null;

  const nothing = isEmptyLayout(layout) && !externalPending && (external?.complete ?? true);
  return (
    <div className="flex flex-col gap-6">
      {!nothing && <SearchFilters value={filter} onChange={onFilter} panelId={panelId} />}
      <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${filter}`} className="flex flex-col gap-8">
        {nothing && (
          <EmptyState>
            <span className="block">{t("search.nothingFound", { query })}</span>
            <span className="mt-1 block text-content-tertiary">{t("search.nothingFoundHint")}</span>
          </EmptyState>
        )}
        {!nothing && filter === "all" && <SearchAllView query={query} layout={layout} albumOwnership={owned.albumOwnership} externalPending={externalPending} onFilter={onFilter} />}
        {!nothing && filter !== "all" && <SearchKindView query={query} filter={filter} library={data} external={ownedKind.lists} albumOwnership={ownedKind.albumOwnership} pending={kind.pending || externalPending} />}
      </div>
    </div>
  );
});
