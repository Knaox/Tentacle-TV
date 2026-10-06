import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { recoItemsOf } from "./recoCacheItems";
import { retireRecoItem } from "./recoRetirement";
import { isRecoItemHeld } from "./recoRetirementState";
import { REQUESTED_TITLES_KEY } from "./requestedTitlesKey";

/**
 * Un titre DEMANDÉ sort des recommandations du compte — « Pour vous »,
 * Affiner, toute rangée — sans être un goût (le serveur l'exclut, cf.
 * `services/reco/requestedTitles.ts`). Côté client :
 *
 *   • une demande faite d'une carte du cœur (`useRequestTitle`) pose la clé
 *     tout de suite (`markTitleRequested`) ;
 *   • une demande faite dans la page de l'extension, le client l'apprend en
 *     relisant la liste (`useRequestedTitles`, au retour sur l'écran).
 *
 * Le titre quitte alors les pages en cache — tout de suite si personne ne le
 * tient, au LÂCHER sinon (règle du retrait, « demandé » vaut jugé :
 * `isRecoItemJudged`). La pile d'Affiner le retire d'elle-même.
 */

/** Les clés demandées que le client connaît déjà. */
export function requestedTitleKeysOf(qc: QueryClient): ReadonlySet<string> {
  return new Set(qc.getQueryData<string[]>(REQUESTED_TITLES_KEY) ?? []);
}

/** Retire le titre des pages en cache, sauf d'une carte tenue (son lâcher le fera). */
function retireUnlessHeld(qc: QueryClient, key: string): void {
  const held = isRecoItemHeld({ key }) || recoItemsOf(qc, key).some(isRecoItemHeld);
  if (!held) retireRecoItem(qc, key);
}

/** Le compte vient de demander ce titre. */
export function markTitleRequested(qc: QueryClient, key: string): void {
  qc.setQueryData<string[]>(REQUESTED_TITLES_KEY, (old) => (old?.includes(key) ? old : [...(old ?? []), key]));
  retireUnlessHeld(qc, key);
}

/** Retire des pages ce que la liste relue a appris (une demande faite ailleurs). */
export function retireRequestedTitles(qc: QueryClient, keys: readonly string[]): void {
  for (const key of keys) retireUnlessHeld(qc, key);
}

/**
 * La liste des titres demandés, relue à chaque montage et au retour sur la
 * fenêtre ; `refetch` pour un écran natif qui reprend le focus. Un serveur
 * d'avant n'a pas la route (capacité `reco.requestedTitles`) : rien n'est
 * demandé, liste vide.
 */
export function useRequestedTitles(options: { enabled?: boolean } = {}) {
  const qc = useQueryClient();
  const supported = useServerCapability("reco.requestedTitles");
  const query = useQuery({
    queryKey: REQUESTED_TITLES_KEY,
    queryFn: async () => (await tentacleApiFetch<{ keys?: unknown }>("/api/reco/requested")).keys,
    select: (keys: unknown) => (Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string") : []),
    staleTime: 0,
    retry: false,
    enabled: supported && (options.enabled ?? true),
  });
  const keys = query.data;
  useEffect(() => {
    if (keys?.length) retireRequestedTitles(qc, keys);
  }, [qc, keys]);
  // `refetch` passe outre `enabled` : sans la route, il ne demande rien non plus.
  return { keys: keys ?? EMPTY, refetch: supported ? query.refetch : skipRefetch };
}

const EMPTY: readonly string[] = [];

async function skipRefetch(): Promise<void> {}
