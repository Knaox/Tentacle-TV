/**
 * Le module serveur d'un plugin dans le processus qui répond : chargé
 * (`running`), en échec (`failed`), présent mais pas chargé (`idle`), absent.
 */
export type ServerModuleState = "none" | "running" | "failed" | "idle";

export interface InstalledPlugin {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  sourceId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  installedAt: string;
  hasBundle?: boolean;
  navItems?: Array<{
    path: string;
    icon: string;
    platforms: string[];
    admin?: boolean;
    labels?: Record<string, string>;
    label?: string | Record<string, string>;
  }>;
  // Serveur 1.19.3 et plus — absents d'un serveur plus ancien, et l'interface
  // se tait alors sur le redémarrage plutôt que de le deviner.
  serverModule?: { state: ServerModuleState; detail?: string };
  /** L'activation attend un redémarrage : module à démarrer, ou à arrêter. */
  restartRequired?: boolean;
  /** Les gestes qui redémarreront le serveur. */
  restartsOn?: { update: boolean; uninstall: boolean };
}

export interface MarketplacePlugin {
  pluginId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  sourceId: string;
  sourceName: string;
  official: boolean;
  installed: boolean;
  installedId?: string;
  installedVersion?: string;
  updateAvailable: boolean;
  downloadUrl?: string;
  icon?: string;
  tags?: string[];
  category?: string;
  repo?: string;
  platforms?: string[];
  /** Notes de la version publiée (Markdown, blocs `### FR` / `### EN`) — serveur 1.19.3+. */
  changelog?: string;
  releaseDate?: string;
}

/** La dernière lecture du registre d'une source (serveur 1.19.3+). */
export interface RegistryStatus {
  checkedAt: string;
  /** Dernière lecture réussie ; absente si aucune n'a réussi. */
  fetchedAt?: string;
  pluginCount: number;
  error?: string;
}

export interface PluginSource {
  id: string;
  name: string;
  url: string;
  official: boolean;
  enabled: boolean;
  /** Absent tant que le registre n'a pas été lu (ou d'un serveur plus ancien). */
  registry?: RegistryStatus;
}

/** Ce que rend un geste qui peut redémarrer le serveur (1.19.3+). */
export interface RestartInfo {
  restartScheduled?: boolean;
  /** Le processus qui a répondu : l'interface attend qu'un autre lui succède. */
  bootId?: string;
}

export interface RefreshResult {
  refreshed: number;
  plugins: number;
  failed?: number;
  sources?: PluginSource[];
}
