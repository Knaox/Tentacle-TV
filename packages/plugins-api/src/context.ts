import { createContext } from "react";
import type { TentaclePlugin } from "./types";

/** Metadata for an active plugin (from backend /api/plugins/active). */
export interface ActivePluginMeta {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  hasBundle: boolean;
  configEnabled?: boolean;
  navItems: Array<{
    label?: string | Record<string, string>;
    labels?: Record<string, string>;
    path: string;
    icon: string;
    platforms: string[];
    admin?: boolean;
  }>;
  /** Onglet mobile de l'extension (champ `tab` du manifeste), relayé s'il est bien formé. */
  tab?: { icon?: string; labels?: Record<string, string> };
  /**
   * Recherche hors bibliothèque (champ `search` du manifeste) : une route du
   * serveur du plugin que la recherche de Tentacle interroge, et le nom de la
   * section où ses résultats s'affichent. Absent si l'intégration est éteinte.
   */
  search?: {
    path: string;
    /** Route de la filmographie hors bibliothèque (champ `search.person`), si le plugin en sert une. */
    person?: string;
    types?: Array<"movie" | "series">;
    labels?: Record<string, string>;
  };
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
  /** Re-fetch active plugins from backend (e.g. after login) */
  refreshPlugins: () => void;
}

export const PluginContext = createContext<PluginContextValue>({
  plugins: [],
  enabledPlugins: [],
  isPluginEnabled: () => false,
  loading: true,
  activePluginsMeta: [],
  refreshPlugins: () => {},
});
