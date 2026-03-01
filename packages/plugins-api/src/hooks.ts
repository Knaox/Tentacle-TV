import { useContext, useMemo } from "react";
import { PluginContext } from "./context";
import type { TentaclePlugin, PluginNavItem, PluginRoute, PluginPlatform } from "./types";

/** Access the full plugin context. */
export function usePlugins() {
  return useContext(PluginContext);
}

/** Check if a specific plugin is enabled. */
export function usePluginEnabled(pluginId: string): boolean {
  const { isPluginEnabled } = useContext(PluginContext);
  return isPluginEnabled(pluginId);
}

/** Get a specific plugin by id (from enabled plugins only). */
export function usePlugin(pluginId: string): TentaclePlugin | undefined {
  const { enabledPlugins } = useContext(PluginContext);
  return enabledPlugins.find((p) => p.id === pluginId);
}

/** Get all nav items for a specific platform from enabled plugins. */
export function usePluginNavItems(platform: PluginPlatform): PluginNavItem[] {
  const { enabledPlugins } = useContext(PluginContext);
  return useMemo(
    () =>
      enabledPlugins.flatMap((plugin) =>
        plugin.navItems.filter((item) => item.platforms.includes(platform))
      ),
    [enabledPlugins, platform],
  );
}

/** Get all routes from enabled plugins. */
export function usePluginRoutes(): PluginRoute[] {
  const { enabledPlugins } = useContext(PluginContext);
  return useMemo(
    () => enabledPlugins.flatMap((plugin) => plugin.routes),
    [enabledPlugins],
  );
}

/** Get all admin routes from enabled plugins. */
export function usePluginAdminRoutes(): PluginRoute[] {
  const { enabledPlugins } = useContext(PluginContext);
  return useMemo(
    () => enabledPlugins.flatMap((plugin) => plugin.adminRoutes ?? []),
    [enabledPlugins],
  );
}

/** Get all admin nav items from enabled plugins. */
export function usePluginAdminNavItems(): PluginNavItem[] {
  const { enabledPlugins } = useContext(PluginContext);
  return useMemo(
    () => enabledPlugins.flatMap((plugin) => plugin.adminNavItems ?? []),
    [enabledPlugins],
  );
}
