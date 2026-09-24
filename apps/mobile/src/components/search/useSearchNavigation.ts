import { useCallback } from "react";
import { useRouter } from "expo-router";
import type { ExternalSearchItem, SearchProvider } from "@tentacle-tv/shared";

/**
 * Où mène un résultat. La recherche est une MODALE : une fiche s'ouvre sur la
 * pile principale, la modale d'abord refermée — `dismiss` puis `push` au tick
 * suivant, pour que les deux se jouent dans l'ordre (`runAfterInteractions`
 * ne rappelait pas toujours). Le lecteur, lui, se pose par-dessus.
 */
export function useSearchNavigation() {
  const router = useRouter();

  const fromModal = useCallback((go: () => void) => {
    if (router.canDismiss()) router.dismiss();
    setTimeout(go, 0);
  }, [router]);

  const openItem = useCallback((id: string) => {
    fromModal(() => router.push(`/media/${id}`));
  }, [fromModal, router]);

  const playItem = useCallback((id: string) => {
    fromModal(() => router.push(`/watch/${id}`));
  }, [fromModal, router]);

  /**
   * Un titre hors bibliothèque ouvre la page du plugin qui l'a trouvé, par sa
   * route (`/discover?media=movie:603`) : chemin et requête séparés, comme le
   * deep-link des recommandations. Le lien est déjà validé (interne, borné).
   */
  const openExternal = useCallback((provider: SearchProvider, href: string) => {
    const at = href.indexOf("?");
    const path = at < 0 ? href : href.slice(0, at);
    const query = at < 0 ? undefined : href.slice(at);
    fromModal(() => router.push({
      pathname: "/plugin/[pluginId]",
      params: { pluginId: provider.pluginId, path, ...(query ? { query } : {}) },
    }));
  }, [fromModal, router]);

  const openExternalItem = useCallback((provider: SearchProvider, item: ExternalSearchItem) => {
    openExternal(provider, item.href);
  }, [openExternal]);

  return { openItem, playItem, openExternal, openExternalItem };
}
