// Types
export type {
  TentaclePlugin,
  PluginRoute,
  PluginNavItem,
  PluginPlatform,
  PluginConfig,
  PluginRegistryVersion,
  PluginRegistryEntry,
  PluginRegistryManifest,
  InstalledPlugin,
  PluginSource,
} from "./types";

// Registry
export {
  registerPlugin,
  unregisterPlugin,
  getPlugin,
  getAllPlugins,
  subscribeRegistry,
  getRegistrySnapshot,
} from "./registry";

// Le bac à sable des pages d'extension (aucun formulaire natif : voir iframeSandbox.ts)
export { PLUGIN_IFRAME_SANDBOX } from "./iframeSandbox";

// Context & Provider
export { PluginContext } from "./context";
export type { PluginContextValue, ActivePluginMeta } from "./context";
export { PluginProvider } from "./PluginProvider";

// Hooks
export {
  usePlugins,
  usePluginEnabled,
  usePlugin,
  usePluginNavItems,
  usePluginRoutes,
  usePluginAdminRoutes,
  usePluginAdminNavItems,
  useActivePluginsMeta,
  useRefreshPlugins,
} from "./hooks";
