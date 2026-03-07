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
} from "./hooks";
