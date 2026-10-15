import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDeletableEntries, useLibraryDeletionRights } from "@tentacle-tv/api-client";
import { deletionAllowedSomewhere, type SearchMediaItem } from "@tentacle-tv/shared";
import { useDeletionMode, type DeletionMode } from "../../libraryDelete/useDeletionMode";
import { DELETABLE_TYPES, type SelectMark } from "../../libraryDelete/useDeletionSelection";

/**
 * Supprimer des titres depuis la RECHERCHE — les onglets d'un seul type (Films,
 * Séries, Épisodes), où la grille montre tous les résultats. Permis si la
 * politique du compte autorise la suppression quelque part ; chaque titre est
 * ensuite jugé par Jellyfin (`CanDelete`, relevé à l'entrée du mode). « Tout
 * sélectionner » couvre les résultats affichés ; le serveur en plafonne le
 * nombre (60) et la barre le dit quand il y en a davantage.
 */

interface CardSelection {
  markOf: (id: string) => SelectMark;
  toggle: (id: string, range: boolean) => void;
}

const SearchSelectionContext = createContext<CardSelection | null>(null);

/** Le repère d'une carte de résultat en mode sélection ; `undefined` hors du mode. */
export function useSearchSelection(id: string): { mark: SelectMark; toggle: (id: string, range: boolean) => void } | undefined {
  const selection = useContext(SearchSelectionContext);
  return selection ? { mark: selection.markOf(id), toggle: selection.toggle } : undefined;
}

export function useSearchDeletionMode(items: readonly SearchMediaItem[], total: number | undefined): DeletionMode & { scope: (children: ReactNode) => ReactNode } {
  const { t } = useTranslation("libraryDelete");
  const { data: rights } = useLibraryDeletionRights();
  const [active, setActive] = useState(false);
  const allowed = deletionAllowedSomewhere(rights) && items.some((item) => DELETABLE_TYPES.has(item.Type));
  const ids = useMemo(() => items.filter((item) => DELETABLE_TYPES.has(item.Type)).map((item) => item.Id), [items]);
  const deletable = useDeletableEntries(ids, active && allowed);
  const entries = deletable.data?.entries;
  const universe = useMemo(() => (entries ? ids.filter((id) => entries.has(id)) : []), [ids, entries]);

  const mode = useDeletionMode({
    allowed,
    active,
    setActive,
    universe,
    entries,
    failed: deletable.isError && !deletable.data,
    onRetry: () => void deletable.refetch(),
    note: total !== undefined && total > items.length ? t("searchCapped", { shown: items.length, total }) : null,
  });

  const { selection } = mode;
  const value = useMemo<CardSelection | null>(
    () => (selection.active ? { markOf: selection.markOf, toggle: selection.toggle } : null),
    [selection.active, selection.markOf, selection.toggle],
  );
  const scope = (children: ReactNode) => (
    <SearchSelectionContext.Provider value={value}>{children}</SearchSelectionContext.Provider>
  );
  return { ...mode, scope };
}
