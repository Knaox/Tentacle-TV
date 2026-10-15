import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLibraryDeletableIndex, useLibraryDeletionRights, type CatalogFilters } from "@tentacle-tv/api-client";
import { deletionAllowedIn } from "@tentacle-tv/shared";
import { useDeletionMode, type DeletionMode } from "./useDeletionMode";

/**
 * Le mode sélection d'une grille de BIBLIOTHÈQUE : permis si la politique du
 * compte l'autorise dans CETTE bibliothèque ; « tout sélectionner » porte sur la
 * bibliothèque filtrée ENTIÈRE (relevé `CanDelete` de tous ses titres, mêmes
 * filtres et même tri que la grille), pas sur les pages chargées.
 *
 * Seule exception : le filtre de plateforme, que la grille applique elle-même aux
 * titres chargés — « tout sélectionner » couvre alors ce qu'elle affiche, et le dit.
 */
export function useLibraryDeletionMode(
  libraryId: string,
  filters: CatalogFilters,
  displayedIds: readonly string[],
  platformActive: boolean,
): DeletionMode {
  const { t } = useTranslation("libraryDelete");
  const { data: rights } = useLibraryDeletionRights();
  const allowed = deletionAllowedIn(rights, libraryId);
  const [active, setActive] = useState(false);
  const index = useLibraryDeletableIndex(libraryId, filters, active && allowed);

  const universe = useMemo(() => {
    const entries = index.data?.entries;
    if (!entries) return [];
    return platformActive ? displayedIds.filter((id) => entries.has(id)) : index.data?.order ?? [];
  }, [index.data, platformActive, displayedIds]);

  return useDeletionMode({
    allowed,
    active,
    setActive,
    universe,
    entries: index.data?.entries,
    failed: index.isError && !index.data,
    onRetry: () => void index.refetch(),
    note: platformActive ? t("platformScope") : null,
  });
}
