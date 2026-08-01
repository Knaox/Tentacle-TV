import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";

export type CollectionFilterTab = "all" | "Movie" | "Series";

/**
 * Onglet de filtre d'une grille de collection, et la liste filtrée qui en
 * découle.
 *
 * `onFilteredIdsChange` reçoit TOUS les identifiants filtrés, jamais seulement
 * ceux qui sont rendus : c'est ce qui alimente « tout sélectionner », et la
 * virtualisation ne doit rien y changer.
 *
 * La comparaison passe par une jointure de chaînes plutôt que par l'identité du
 * tableau : `filter()` en fabrique un neuf à chaque rendu, et notifier le parent
 * à chaque fois relançait son propre rendu — donc le nôtre — en boucle.
 */
export function useCollectionFilter(
  items: MediaItem[] | undefined,
  onFilteredIdsChange?: (ids: string[]) => void,
) {
  const { t } = useTranslation("common");
  const [filter, setFilter] = useState<CollectionFilterTab>("all");

  const filtered = useMemo(
    () => items?.filter((item) => filter === "all" || item.Type === filter),
    [items, filter],
  );

  const idsRef = useRef<string[]>([]);
  const ids = filtered?.map((i) => i.Id) ?? [];
  if (ids.join(",") !== idsRef.current.join(",")) idsRef.current = ids;
  useEffect(() => {
    onFilteredIdsChange?.(idsRef.current);
  }, [idsRef.current, onFilteredIdsChange]);

  const tabs: { key: CollectionFilterTab; label: string }[] = [
    { key: "all", label: t("common:allFilter") },
    { key: "Movie", label: t("common:moviesFilter") },
    { key: "Series", label: t("common:seriesFilter") },
  ];

  return { filter, setFilter, filtered, tabs };
}
