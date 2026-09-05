import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";

export interface RecoNavigable {
  jellyfinItemId: string | null;
  mediaType: "movie" | "tv";
  tmdbId: number;
}

/**
 * LA bifurcation de navigation des recommandations — centralisée ici, jamais
 * dupliquée dans les cartes : un titre en bibliothèque ouvre sa fiche Jellyfin
 * (`/media/:id`) ; un titre hors bibliothèque ouvre la fiche catalogue Vigie
 * par deep-link (`/discover?media=movie:603`) quand le plugin est actif ;
 * sans plugin, il n'y a nulle part où aller (`canOpen` = false, la carte le
 * dit) — jamais une fiche Jellyfin vide.
 */
export function useRecoNavigation() {
  const navigate = useNavigate();
  const activePluginsMeta = useActivePluginsMeta();

  const vigieDiscoverPath = useMemo(() => {
    for (const plugin of activePluginsMeta) {
      if (plugin.pluginId !== "seer" || plugin.configEnabled !== true) continue;
      const nav = (plugin.navItems || []).find(
        (n) => !n.admin && n.path.endsWith("/discover") && n.platforms?.includes("web")
      );
      if (nav) return nav.path;
    }
    return null;
  }, [activePluginsMeta]);

  const canOpen = useCallback(
    (item: RecoNavigable) => !!item.jellyfinItemId || !!vigieDiscoverPath,
    [vigieDiscoverPath]
  );

  const open = useCallback(
    (item: RecoNavigable) => {
      if (item.jellyfinItemId) {
        navigate(`/media/${item.jellyfinItemId}`);
        return;
      }
      if (vigieDiscoverPath) {
        navigate(`${vigieDiscoverPath}?media=${item.mediaType}:${item.tmdbId}`);
      }
    },
    [navigate, vigieDiscoverPath]
  );

  return { open, canOpen, vigieAvailable: !!vigieDiscoverPath };
}
