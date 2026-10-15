import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AppNotification } from "./useNotifications";
import { backendFetch, useMarkRead } from "./useNotifications";
import type { NotifPluginMeta } from "../utils/notificationRoute";
import {
  immediateTargetRoute,
  resolveNotificationDestination,
  type LibraryTitleLookup,
  type NotificationPlatform,
} from "../utils/notificationDestination";

/** Un titre de la bibliothèque par son TMDB — la route du serveur que la fiche Vigie emploie déjà. */
export const lookupLibraryTitle: LibraryTitleLookup = async (mediaType, tmdbId) => {
  const res = await backendFetch<{ jellyfinId: string | null }>(
    `/api/tmdb/resolve?tmdbId=${encodeURIComponent(String(tmdbId))}&mediaType=${mediaType}`,
  );
  return res.jellyfinId ?? null;
};

interface OpenerOptions {
  platform: NotificationPlatform;
  plugins: NotifPluginMeta[] | undefined;
  navigate: (route: string) => void;
  /** Appelé au moment de partir (fermer le panneau…) — seulement s'il y a une destination. */
  onLeave?: () => void;
}

/**
 * Ouvrir une notification : la marquer lue, puis aller à sa destination
 * exacte. Une cible immédiate part tout de suite ; un titre à chercher part
 * à la réponse (gardée 5 min : un second clic ne refait pas la recherche).
 * Rend `true` si la notification mène quelque part (tout de suite ou bientôt).
 */
export function useNotificationOpener({ platform, plugins, navigate, onLeave }: OpenerOptions) {
  const qc = useQueryClient();
  const markRead = useMarkRead();
  const pending = useRef<string | null>(null);

  const lookup = useCallback<LibraryTitleLookup>(
    (mediaType, tmdbId) =>
      qc.fetchQuery({
        queryKey: ["notification-title", mediaType, tmdbId],
        queryFn: () => lookupLibraryTitle(mediaType, tmdbId),
        staleTime: 5 * 60_000,
      }),
    [qc],
  );

  return useCallback(
    (n: AppNotification): void => {
      if (!n.read) markRead.mutate(n.id);
      const immediate = n.target ? immediateTargetRoute(n.target, platform, plugins) : null;
      if (immediate) {
        onLeave?.();
        navigate(immediate);
        return;
      }
      // Un seul trajet à la fois : un double clic ne navigue pas deux fois.
      if (pending.current === n.id) return;
      pending.current = n.id;
      void resolveNotificationDestination(n, platform, plugins, lookup).then((route) => {
        pending.current = null;
        if (!route) return;
        onLeave?.();
        navigate(route);
      });
    },
    [lookup, markRead, navigate, onLeave, platform, plugins],
  );
}
