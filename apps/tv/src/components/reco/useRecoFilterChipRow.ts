import { useMemo } from "react";
import { firstServedRecoRowKey, useRecoPage, useRecoSettings } from "@tentacle-tv/api-client";
import type { HomeRowDescriptor } from "@tentacle-tv/api-client";

const EMPTY: number[] = [];

/**
 * La rangée reco de l'accueil qui porte la pastille du filtre : la première,
 * dans l'ordre de l'accueil, RÉELLEMENT servie sous le filtre du compte —
 * null sans filtre, sans rangée reco, ou tant que la page n'est pas là. Même
 * entrée de cache que les rangées elles-mêmes : aucune requête en plus.
 */
export function useRecoFilterChipRow(rows: readonly HomeRowDescriptor[]): string | null {
  const settings = useRecoSettings();
  const filter = settings.data?.providerFilter ?? EMPTY;
  const settingsReady = settings.isSuccess || settings.isError;
  const wanted = filter.length > 0 && rows.some((row) => row.key.startsWith("reco:"));
  const { data: page } = useRecoPage(filter, { enabled: settingsReady && wanted });
  return useMemo(
    () => (wanted && page ? firstServedRecoRowKey(rows, page.rows.map((row) => row.key)) : null),
    [wanted, page, rows],
  );
}
