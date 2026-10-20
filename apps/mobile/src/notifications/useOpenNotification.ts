import { useCallback, useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTentacleConfig, type LibraryTitleLookup } from "@tentacle-tv/api-client";
import { activePluginsQueryOptions, toNotifPluginMeta } from "@/hooks/useActivePlugins";
import { openNotificationRoute } from "@/utils/openNotificationRoute";
import { libraryTitleLookup } from "@/services/notificationDestination";
import { openFamilyNotification } from "@/family/familyPosterStore";
import { openNotification, type NotificationOpenPorts, type NotificationOrigin, type OpenableNotification } from "./openNotification";

/** Un geste ne doit jamais rester figé : au-delà, on part sans les extensions. */
const PLUGIN_META_TIMEOUT_MS = 3000;
/** Un titre retrouvé reste connu 5 min : un second appui ne refait pas la recherche. */
const TITLE_LOOKUP_STALE_MS = 5 * 60_000;

/**
 * L'ouverture d'une notification sur le mobile, la MÊME pour la cloche et
 * pour les push. Les extensions : le cache s'il est chaud, sinon une lecture
 * bornée (serveur injoignable → la route du type, ou l'accueil pour une push).
 * Un appui répété sur la même notification pendant qu'elle se résout ne
 * navigue qu'une fois.
 */
export function useOpenNotification(): (n: OpenableNotification & { id?: string }, origin: NotificationOrigin) => Promise<void> {
  const router = useRouter();
  const qc = useQueryClient();
  const { storage } = useTentacleConfig();
  const pending = useRef<string | null>(null);
  // Relus à chaque rendu : une reconnexion change la donne.
  const serverUrl = storage.getItem("tentacle_server_url") ?? "";
  const token = storage.getItem("tentacle_token") ?? "";

  const ports = useMemo<NotificationOpenPorts>(() => {
    const rawLookup = libraryTitleLookup(serverUrl, token);
    const lookupTitle: LibraryTitleLookup = (mediaType, tmdbId) =>
      qc.fetchQuery({
        queryKey: ["notification-title", serverUrl, mediaType, tmdbId],
        queryFn: () => rawLookup(mediaType, tmdbId),
        staleTime: TITLE_LOOKUP_STALE_MS,
      });
    return {
      goTo: (route) => openNotificationRoute(router, route),
      openOnDevice: () => openNotificationRoute(router, "/on-device"),
      openFamilyPoster: (invitationId) => { openFamilyNotification(router, { type: "family_invite", refId: invitationId }); },
      loadPlugins: async () => {
        if (!serverUrl || !token) return [];
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const plugins = await Promise.race([
            qc.ensureQueryData(activePluginsQueryOptions(serverUrl, token)),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("plugins timeout")), PLUGIN_META_TIMEOUT_MS); }),
          ]);
          return toNotifPluginMeta(plugins);
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      lookupTitle,
    };
  }, [router, qc, serverUrl, token]);

  return useCallback(async (n, origin) => {
    const key = n.id ?? null;
    if (key && pending.current === key) return;
    pending.current = key;
    try {
      await openNotification(n, origin, ports);
    } finally {
      if (pending.current === key) pending.current = null;
    }
  }, [ports]);
}
