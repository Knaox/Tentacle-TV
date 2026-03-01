import { createContext } from "react";
import type { TentaclePlugin } from "./types";

export interface PluginContextValue {
  /** All registered plugins */
  plugins: TentaclePlugin[];
  /** Only plugins that are configured and enabled */
  enabledPlugins: TentaclePlugin[];
  /** Check if a specific plugin is enabled */
  isPluginEnabled: (id: string) => boolean;
  /** Loading state while checking plugin configs */
  loading: boolean;
}

export const PluginContext = createContext<PluginContextValue>({
  plugins: [],
  enabledPlugins: [],
  isPluginEnabled: () => false,
  loading: true,
});
