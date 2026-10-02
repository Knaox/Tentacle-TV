import { useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  TITLE_GAPS_BATCH,
  readTitleGaps,
  titleGapsUrl,
  type TitleKey,
  type TitleProvider,
  type TitleSeason,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { createTitleBatcher } from "./titleKeyBatcher";

/**
 * Les saisons qui manquent aux séries de la bibliothèque, chez l'extension de
 * demandes (route `gaps` du contrat `titles`, `pluginTitleGaps.ts`) — ce qui
 * fait offrir « 2 saisons à demander » sur une série incomplète.
 *
 * Une entrée de cache PAR série, mais UNE requête pour toutes celles qu'une
 * page monte ensemble (`loadTitleGaps`) : retaper la recherche ne redemande
 * que les séries nouvelles, et la fiche d'une série retrouve ce que sa carte
 * a lu. Une demande de saisons relit l'entrée de sa série
 * (`useRequestTitleSeasons`).
 *
 * Écrit pour TanStack Query v4 ET v5 — la TV est en v4 : des options
 * communes seulement.
 */

export function titleGapsQueryKey(provider: TitleProvider | null, lang: string, key: TitleKey | null) {
  return ["title-gaps", provider?.pluginId ?? "", lang, key ?? ""] as const;
}

/** Ce qui manque à UNE série, regroupé avec les séries que les autres cartes demandent au même instant. */
export const loadTitleGaps = createTitleBatcher<TitleSeason[]>({
  id: (provider, lang) => `${provider.pluginId}|${provider.gapsPath ?? ""}|${lang}`,
  url: titleGapsUrl,
  read: readTitleGaps,
  // Une série dont l'extension ne dit rien : complète, ou inconnue — rien à offrir.
  missing: [],
  batch: TITLE_GAPS_BATCH,
});

const fetcher = (url: string) => tentacleApiFetch(url);
const NONE: ReadonlyMap<TitleKey, TitleSeason[]> = new Map();

/**
 * Les saisons manquantes de chaque série demandée, lues — une série absente
 * de la carte n'est pas encore lue, ou n'a pas de trou. `null` : l'extension
 * ne déclare pas la route (ou rien n'est demandé), aucune série n'offre rien.
 */
export function useTitleGaps(
  provider: TitleProvider | null,
  keys: readonly TitleKey[],
  lang: string,
  options?: { enabled?: boolean },
): ReadonlyMap<TitleKey, TitleSeason[]> | null {
  const open = provider !== null && provider.gapsPath !== null && (options?.enabled ?? true);
  const results = useQueries({
    queries: keys.map((key) => ({
      queryKey: titleGapsQueryKey(provider, lang, key),
      queryFn: () => loadTitleGaps(provider as TitleProvider, key, lang, fetcher),
      enabled: open,
      // Ce qui change les trous (une demande) passe par ici et les relit ; une
      // arrivée peut attendre la minute.
      staleTime: 60_000,
      retry: 1,
    })),
  });

  // Les réponses se relisent à chaque rendu (v4) : une nouvelle carte ne vaut
  // que si l'une d'elles a changé.
  const values = results.map((r) => (r.data ?? null) as TitleSeason[] | null);
  const kept = useRef<{ keys: readonly TitleKey[]; values: (TitleSeason[] | null)[] }>({ keys, values });
  const same = kept.current.keys === keys && kept.current.values.length === values.length
    && kept.current.values.every((v, i) => v === values[i]);
  if (!same) kept.current = { keys, values };
  const stable = kept.current.values;

  return useMemo(() => {
    if (!open) return null;
    if (keys.length === 0) return NONE;
    const out = new Map<TitleKey, TitleSeason[]>();
    keys.forEach((key, i) => {
      const seasons = stable[i];
      if (seasons && seasons.length > 0) out.set(key, seasons);
    });
    return out;
  }, [open, keys, stable]);
}
