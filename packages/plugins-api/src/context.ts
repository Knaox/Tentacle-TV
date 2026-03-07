import { createContext } from "react";
import type { TentaclePlugin } from "./types";

/** Metadata for an active plugin (from backend /api/plugins/active). */
export interface ActivePluginMeta {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  hasBundle: boolean;
  navItems: Array<{
    label?: string | Record<string, string>;
    labels?: Record<string, string>;
    path: string;
    icon: string;
    platforms: string[];
    admin?: boolean;
  }>;
}

export interface PluginContextValue {
  /** All registered plugins */
  plugins: TentaclePlugin[];
  /** Only plugins that are configured and enabled */
  enabledPlugins: TentaclePlugin[];
  /** Check if a specific plugin is enabled */
  isPluginEnabled: (id: string) => boolean;
  /** Loading state while checking plugin configs */
  loading: boolean;
  /** Active plugins metadata from backend (for iframe-based rendering) */
  activePluginsMeta: ActivePluginMeta[];
}

export const PluginContext = createContext<PluginContextValue>({
  plugins: [],
  enabledPlugins: [],
  isPluginEnabled: () => false,
  loading: true,
  activePluginsMeta: [],
});
