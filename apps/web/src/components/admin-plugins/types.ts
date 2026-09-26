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
  // Serveur 1.20 et plus — absents d'un serveur plus ancien, et l'interface
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
  /** Notes de la version publiée (Markdown, blocs `### FR` / `### EN`) — serveur 1.20+. */
  changelog?: string;
  releaseDate?: string;
}

/** La dernière lecture du registre d'une source (serveur 1.20+). */
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

/** Ce que rend un geste qui peut redémarrer le serveur (1.20+). */
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

/**
 * Tokens visuels des onglets plugins.
 *
 * ATTENTION : ce `cls` LOCAL masque celui de `pages/adminUtils` — les onglets
 * importent CELUI-CI. Il etait reste en `white/*` durs et a echappe a la
 * migration clair/sombre (le balayage ciblait les .tsx, pas ce .ts) :
 * boutons et lignes etaient blanc-sur-blanc en theme clair.
 */
export const cls = {
  card: "rounded-xl border border-line-subtle bg-fill-faint p-5",
  row: "flex items-center justify-between gap-4 rounded-lg border border-line-subtle bg-fill-faint p-4",
  bp: "rounded-lg bg-[var(--brand-soft)] border border-[var(--brand)]/45 px-4 py-1.5 text-xs font-semibold text-[var(--brand-light)] hover:bg-[var(--brand)]/25 disabled:opacity-40 transition-colors",
  bs: "rounded-lg bg-fill-soft px-4 py-1.5 text-xs font-medium text-content-secondary hover:bg-fill-medium hover:text-content-primary disabled:opacity-40 transition-colors",
  bd: "rounded-lg bg-danger-surface px-4 py-1.5 text-xs font-medium text-status-error-fg hover:bg-danger-surface-hover disabled:opacity-40 transition-colors",
  inp: "w-full rounded-lg bg-fill-subtle px-3 py-2 text-sm text-content-primary outline-none ring-1 ring-line-subtle focus:ring-[var(--brand)] placeholder-content-quaternary",
  lbl: "mb-1 block text-xs text-content-quaternary",
  empty: "py-12 text-center text-sm text-content-quaternary",
  spinner: "flex justify-center py-12",
};
