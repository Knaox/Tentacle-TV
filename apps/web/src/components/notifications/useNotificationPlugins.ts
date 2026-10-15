import { useMemo } from "react";
import type { NotifPluginMeta } from "@tentacle-tv/api-client";
import { useActivePluginsMeta } from "@tentacle-tv/plugins-api";

/**
 * Les pages publiées par les extensions ACTIVES, ce que la cloche (web, bureau,
 * miroir) consulte pour ouvrir une page d'extension désignée par une
 * notification. Les pages d'administration n'en sont pas.
 */
export function useNotificationPlugins(): NotifPluginMeta[] {
  const plugins = useActivePluginsMeta();
  return useMemo(
    () =>
      plugins
        .filter((p) => p.configEnabled)
        .map((p) => ({
          pluginId: p.pluginId,
          navItems: (p.navItems || []).filter((n: Record<string, unknown>) => !n.admin) as Array<{ path: string; platforms: string[] }>,
        })),
    [plugins],
  );
}
