import { useMemo } from "react";
import { useLibraryCatalogCounts, type CatalogFilters } from "@tentacle-tv/api-client";
import {
  DEFAULT_LIBRARY_GROUP,
  libraryGroupCandidates,
  libraryGroupsFromCounts,
  type LibraryGroup,
  type LibraryGroupMode,
} from "@tentacle-tv/tv-core";
import type { LibraryFilterState } from "../../hooks/libraryCatalogParams";
import type { GenreOption } from "../library/libraryFilterModel";
import { groupBaseParams, groupQueryParams } from "./libraryRowParams";

export interface LibraryRowGroups {
  /** Le rangement appliqué (une bibliothèque sans genres se range par lettres). */
  mode: LibraryGroupMode;
  /** La base des requêtes des rangées : les filtres posés. */
  base: CatalogFilters;
  /** Les rangées ; `null` tant qu'un compte manque (l'ordre en dépend). */
  groups: LibraryGroup[] | null;
  /** Les titres des filtres courants, tous groupes confondus. */
  total: number | undefined;
  /** Un compte a échoué, et rien n'est à montrer. */
  failed: boolean;
  retry: () => void;
}

/**
 * Les rangées d'une bibliothèque (tv-core `groups/libraryGroups.ts`) : les
 * candidats du rangement choisi, réduits aux filtres posés ; leurs comptes
 * (`useLibraryCatalogCounts` — aucun titre chargé), avec celui de toute la
 * sélection en tête (« 312 titres », le vide des filtres trop serrés) ; puis
 * les rangées, jamais vides, dans leur ordre.
 */
export function useLibraryRowGroups(libraryId: string, filters: LibraryFilterState, genres: GenreOption[] | undefined): LibraryRowGroups {
  const requested = filters.groupBy ?? DEFAULT_LIBRARY_GROUP;
  // Sans genres (métadonnées absentes), aucune rangée de genre : les lettres.
  const mode: LibraryGroupMode = requested === "genre" && genres !== undefined && genres.length === 0 ? "alpha" : requested;
  const base = useMemo(() => groupBaseParams(filters), [filters]);
  const candidates = useMemo(
    () =>
      mode === "genre" && genres === undefined
        ? null
        : libraryGroupCandidates(mode, {
            genres: genres ?? [],
            currentYear: new Date().getFullYear(),
            genreIds: filters.genreIds,
            yearFrom: filters.yearFrom,
            yearTo: filters.yearTo,
            ratingMin: filters.ratingMin,
          }),
    [mode, genres, filters.genreIds, filters.yearFrom, filters.yearTo, filters.ratingMin],
  );
  const list = useMemo(() => [base, ...(candidates ?? []).map((candidate) => groupQueryParams(base, candidate.query))], [base, candidates]);
  const { counts, failed, retry } = useLibraryCatalogCounts(libraryId, list);
  // Les comptes se relisent à chaque rendu (v4) : on n'en garde que la valeur.
  const countsKey = counts.join(",");
  const known = useMemo(() => countsKey.split(",").map((v) => (v === "" ? undefined : Number(v))), [countsKey]);
  const groups = useMemo(() => (candidates ? libraryGroupsFromCounts(mode, candidates, known.slice(1)) : null), [mode, candidates, known]);
  return { mode, base, groups, total: known[0], failed: failed && groups === null, retry };
}
