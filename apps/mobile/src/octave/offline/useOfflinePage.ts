/**
 * Octave (mobile) — la règle `pageView` lue par une page du serveur : son état
 * de requête, le hors ligne, et la collection GARDÉE qui peut la remplacer
 * (`candidates` : ses clés de collection possibles, `playlist:jf:<id>`, `album:<clé>`).
 * Hors de la portée du hors ligne (profil, serveur sans `offline.music`) : aucune collection.
 */

import { useSyncExternalStore } from "react";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { keptMusicStore, subscribeKeptMusic } from "./keptMusic";
import { useOfflineSurface } from "./musicOfflineContext";
import { pageView, type PageView } from "./offlinePageRule";

interface QueryLike {
  data?: unknown;
  isPending: boolean;
  isError: boolean;
}

export function useOfflinePage(query: QueryLike, candidates: readonly string[] = []): { view: PageView; keptKey: string | null } {
  const offline = useOfflineMode();
  const surface = useOfflineSurface();
  // Lu comme une chaîne : la page ne se redessine que si SA collection apparaît ou part.
  const read = () => (surface.visible ? (candidates.find((key) => keptMusicStore.state().collections.some((c) => c.key === key)) ?? null) : null);
  const keptKey = useSyncExternalStore(subscribeKeptMusic, read, read);
  const view = pageView({ hasData: query.data != null, isPending: query.isPending, isError: query.isError, offline, keptCollection: keptKey !== null });
  return { view, keptKey };
}
