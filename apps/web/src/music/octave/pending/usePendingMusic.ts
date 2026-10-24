/**
 * Octave — les entrées EN ATTENTE du compte, toutes extensions confondues
 * (point 4). Relu à `music:pending` et `music:resolved` (useMusicEvents) — jamais
 * un relevé. Sans extension qui le déclare : liste vide, aucune requête.
 */

import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import type { PendingMusicItem } from "@tentacle-tv/shared/music";
import { octaveKeys } from "../data/libraryQueries";
import { externalApi } from "../extension/externalApi";
import { useMusicProviders } from "../extension/musicProviders";

const NONE: PendingMusicItem[] = [];

export function usePendingMusic(): PendingMusicItem[] {
  const user = useUserId();
  const providers = useMusicProviders().filter((p) => !!p.manifest.pending);
  const ids = providers.map((p) => p.pluginId).join(",");
  const query = useQuery({
    queryKey: [...octaveKeys.pending(user), ids],
    queryFn: async () => {
      const lists = await Promise.all(providers.map((p) => externalApi.pending(p).catch(() => ({ items: [] }))));
      return lists.flatMap((l) => l.items);
    },
    enabled: !!user && providers.length > 0,
    staleTime: 15_000,
  });
  return providers.length > 0 ? (query.data ?? NONE) : NONE;
}
