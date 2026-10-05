import { useCallback } from "react";
import { useRouter } from "expo-router";
import type { TitleProvider } from "@tentacle-tv/shared";

/**
 * Ouvre une page de l'extension par sa route (`/discover?media=movie:603`) :
 * on empile l'écran du plugin, chemin et requête séparés. Sans extension, rien.
 */
export function useOpenPluginHref(provider: TitleProvider | null): (href: string) => void {
  const router = useRouter();
  return useCallback((href: string) => {
    if (!provider) return;
    const at = href.indexOf("?");
    const path = at < 0 ? href : href.slice(0, at);
    const query = at < 0 ? undefined : href.slice(at);
    router.push({ pathname: "/plugin/[pluginId]", params: { pluginId: provider.pluginId, path, ...(query ? { query } : {}) } });
  }, [provider, router]);
}
