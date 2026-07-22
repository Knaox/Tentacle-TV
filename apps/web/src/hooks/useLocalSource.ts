import { useQuery } from "@tanstack/react-query";
import { useUserId } from "@tentacle-tv/api-client";
import { localSourceForItem, type LocalSource } from "../downloads/playbackApi";

/**
 * Résolution de la source locale (téléchargement complet vérifié côté Rust) —
 * AVANT toute requête serveur : useWatchSession gate ses queries (DTO,
 * ancestors, config auto-play, segments, navigation) sur `isLocalPlayback`
 * pour garantir ZÉRO consommation réseau en lecture locale, en ligne comme
 * hors ligne. Même clé de query que l'ancienne résolution interne de
 * useDesktopSource (dédup TanStack, aucune requête IPC en double).
 */
export function useLocalSource({
  isDesktop,
  itemId,
}: {
  isDesktop: boolean;
  itemId: string | undefined;
}): {
  localSource: LocalSource | null;
  isLocalPlayback: boolean;
  waitingLocal: boolean;
} {
  const userId = useUserId();
  const query = useQuery({
    queryKey: ["local-source", userId, itemId],
    queryFn: () => localSourceForItem(userId as string, itemId as string),
    enabled: isDesktop && !!userId && !!itemId,
    staleTime: 0,
    gcTime: 5_000,
  });
  const waitingLocal = isDesktop && !!userId && !!itemId && !query.isFetched;
  const localSource = (isDesktop && !waitingLocal ? query.data : null) ?? null;
  return { localSource, isLocalPlayback: !!localSource, waitingLocal };
}
