import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { useActivePlugins } from "./useActivePlugins";

type RecoNavigable = Pick<RecoRowItem, "jellyfinItemId" | "mediaType" | "tmdbId">;

/**
 * LA bifurcation de navigation des recommandations — le motif du web
 * (`lib/recoNavigation.ts`) : un titre en bibliothèque ouvre sa fiche
 * Jellyfin ; un titre hors bibliothèque ouvre la fiche catalogue Vigie dans
 * la WebView du plugin, par deep-link (`/discover?media=movie:603`) quand le
 * plugin est actif et publie cette route pour le mobile ; sans plugin, il n'y
 * a nulle part où aller (`canOpen` = false, la carte le dit).
 */
export function useRecoNavigation() {
  const router = useRouter();
  const { data: plugins } = useActivePlugins();

  const vigie = useMemo(() => {
    const seer = plugins?.find((p) => p.pluginId === "seer");
    const nav = seer?.navItems.find((n) => n.path.endsWith("/discover") && n.platforms.includes("mobile"));
    return seer && nav ? { pluginId: seer.pluginId, path: nav.path } : null;
  }, [plugins]);

  const canOpen = useCallback((item: RecoNavigable) => !!item.jellyfinItemId || vigie !== null, [vigie]);

  const open = useCallback(
    (item: RecoNavigable) => {
      if (item.jellyfinItemId) {
        router.push(`/media/${item.jellyfinItemId}`);
        return;
      }
      if (vigie) {
        router.push({
          pathname: "/plugin/[pluginId]",
          params: { pluginId: vigie.pluginId, path: vigie.path, query: `?media=${item.mediaType}:${item.tmdbId}` },
        });
      }
    },
    [router, vigie],
  );

  return { open, canOpen, vigieAvailable: vigie !== null };
}
