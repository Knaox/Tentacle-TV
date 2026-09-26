import { useMemo } from "react";
import {
  firstServedRecoRowKey,
  reconcileHomeRows,
  useHomeLayout,
  useLibraries,
  useRecoPage,
  visibleHomeRows,
  type HomeLayoutData,
  type HomeRowDescriptor,
} from "@tentacle-tv/api-client";
import { useRecoFilter } from "../../../hooks/useRecoFilter";

/** L'ordre historique de l'app, servi tant que la mise en page du compte
 *  n'est pas là (premier chargement, vieux serveur). */
export const LEGACY_HOME_ROWS: readonly HomeRowDescriptor[] = [
  { key: "resume", enabled: true },
  { key: "nextUp", enabled: true },
  { key: "watchlist", enabled: true },
];

/**
 * `useHomeRows` + `useRecoFilterChipRow` de l'app : les rangées de l'accueil
 * dans l'ordre du COMPTE (la mise en page que le bureau édite), réconciliées
 * avec les bibliothèques réelles et le catalogue du serveur — la même
 * réconciliation partagée (api-client) que le bureau, l'app et la TV. Et la
 * rangée reco qui porte la puce du filtre : la première RÉELLEMENT servie
 * sous ce filtre (même entrée de cache que les rangées, aucune requête en plus).
 */
export function useHomeRows(): {
  rows: HomeRowDescriptor[];
  layout: HomeLayoutData | undefined;
  filterChipRowKey: string | null;
} {
  const { data: layout } = useHomeLayout();
  const { data: libraries } = useLibraries();
  const rows = useMemo(() => {
    const stored = layout?.rows ?? LEGACY_HOME_ROWS;
    const libs = (libraries ?? []).map((l) => ({ id: l.Id, name: l.Name }));
    return visibleHomeRows(
      reconcileHomeRows(stored, libs, { anchorNewLibraries: layout?.stored === false, catalog: layout?.catalog }),
      layout?.catalog,
    ).filter((row) => row.enabled);
  }, [layout, libraries]);

  const { selected } = useRecoFilter();
  const wanted = selected.length > 0 && rows.some((row) => row.key.startsWith("reco:"));
  const { data: page } = useRecoPage(selected, { enabled: wanted });
  const filterChipRowKey = useMemo(
    () => (wanted && page ? firstServedRecoRowKey(rows, page.rows.map((row) => row.key)) : null),
    [wanted, page, rows],
  );
  return { rows, layout, filterChipRowKey };
}
