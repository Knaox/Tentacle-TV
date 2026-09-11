import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collectionGenres, filterCollection, type CollectionTypeTab } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useLibraryFilters } from "../../hooks/useLibraryFilters";
import { usePlatformFilter } from "../../hooks/usePlatformFilter";

export type { CollectionTypeTab };

/**
 * Les filtres de la bibliothèque, appliqués à une collection.
 *
 * `useLibraryFilters` est repris TEL QUEL : il ne lit que les paramètres de
 * l'adresse, il n'a jamais rien su de `/library/:id`. Le bénéfice est le même
 * qu'en bibliothèque — revenir d'une fiche retrouve ses filtres, et une adresse
 * se partage — avec en prime l'onglet Tous/Films/Séries, qui vivait jusqu'ici
 * dans un état local et se perdait à chaque aller-retour.
 *
 * Tout est appliqué EN MÉMOIRE (`filterCollection`) : la liste est déjà
 * entièrement chargée, et sa clé de cache porte l'ajout optimiste de toute
 * l'application — la repaginer le casserait en silence.
 */
export function useCollectionFilters(
  items: MediaItem[] | undefined,
  onFilteredIdsChange?: (ids: string[]) => void,
) {
  const { t } = useTranslation("common");
  const base = useLibraryFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  // L'onglet rejoint l'adresse, avec le reste : deux sources d'état sur la même
  // page finiraient par diverger, et c'est exactement ce que le journal de
  // `useLibraryFilters` raconte avoir payé sur la bibliothèque.
  const type = (searchParams.get("type") as CollectionTypeTab) ?? "all";
  const setType = (next: CollectionTypeTab) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "all") p.delete("type");
        else p.set("type", next);
        return p;
      },
      { replace: true },
    );
  };

  // Le champ répond à la frappe, l'adresse attend 300 ms — le même débrayage
  // que la grille de bibliothèque.
  const [input, setInput] = useState(base.search);
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = input.trim();
      if (value !== base.search) base.setSearch(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [input, base]);

  // Les genres proposés sortent des titres chargés : ces pages n'ont pas de
  // bibliothèque parente à interroger.
  const genres = useMemo(() => collectionGenres(items ?? []), [items]);

  const filtered = useMemo(
    () =>
      filterCollection(items ?? [], {
        search: base.search,
        type,
        genres: base.filters.genreIds,
        yearFrom: base.filters.yearFrom,
        yearTo: base.filters.yearTo,
        ratingMin: base.filters.ratingMin,
        statusFilter: base.filters.statusFilter,
        sortBy: base.filters.sortBy,
        sortOrder: base.filters.sortOrder,
      }),
    [items, base.search, base.filters, type],
  );

  // Le filtre par plateforme reste ce qu'il est en bibliothèque : un appel
  // TMDB, appliqué APRÈS le reste.
  const { filteredItems: visible } = usePlatformFilter(filtered, base.filters.platformIds);

  // `onFilteredIdsChange` reçoit TOUS les identifiants retenus, jamais ceux qui
  // sont rendus : c'est ce qui alimente « tout sélectionner ». La comparaison
  // passe par une jointure plutôt que par l'identité du tableau — `filter()` en
  // fabrique un neuf à chaque rendu, et notifier le parent à chaque fois
  // relançait son rendu, donc le nôtre, en boucle.
  const idsRef = useRef<string[]>([]);
  const ids = visible.map((i) => i.Id);
  if (ids.join(",") !== idsRef.current.join(",")) idsRef.current = ids;
  useEffect(() => {
    onFilteredIdsChange?.(idsRef.current);
  }, [idsRef.current, onFilteredIdsChange]);

  const tabs: { key: CollectionTypeTab; label: string }[] = [
    { key: "all", label: t("common:allFilter") },
    { key: "Movie", label: t("common:moviesFilter") },
    { key: "Series", label: t("common:seriesFilter") },
  ];

  return {
    ...base,
    type,
    setType,
    tabs,
    genres,
    /** Ce que le champ affiche, avant le débrayage. */
    input,
    setInput,
    filtered: visible,
    resultCount: visible.length,
    /** Vrai dès qu'un filtre OU une recherche réduit la liste. */
    isFiltered: base.hasActiveFilters || type !== "all" || base.search.trim().length >= 2,
  };
}

export type CollectionFiltersApi = ReturnType<typeof useCollectionFilters>;
