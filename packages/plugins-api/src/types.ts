import type { ComponentType, LazyExoticComponent } from "react";

/* ------------------------------------------------------------------ */
/*  Core plugin interfaces                                             */
/* ------------------------------------------------------------------ */

export interface TentaclePlugin {
  /** Unique plugin identifier (e.g. "seer") */
  id: string;
  /** Human-readable name */
  name: string;
  /** SemVer version string */
  version: string;
  /** Short description of the plugin */
  description: string;

  /* -- Navigation -------------------------------------------------- */
  routes: PluginRoute[];
  navItems: PluginNavItem[];

  /* -- Admin ------------------------------------------------------- */
  adminRoutes?: PluginRoute[];
  adminNavItems?: PluginNavItem[];

  /* -- Lifecycle --------------------------------------------------- */
  /** Returns true when the plugin has a valid configuration */
  isConfigured: () => Promise<boolean>;
  /** Optional one-time init at startup */
  initialize?: () => Promise<void>;
  /** Optional cleanup */
  destroy?: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Route definition                                                   */
/* ------------------------------------------------------------------ */

export interface PluginRoute {
  path: string;
  component: LazyExoticComponent<ComponentType<unknown>>;
  label: string;
  icon: string | ComponentType<{ className?: string }>;
  showInMobileNav: boolean;
  showInSidebar: boolean;
  requiresAuth: boolean;
  requiresAdmin?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Navigation item                                                    */
/* ------------------------------------------------------------------ */

export type PluginPlatform = "mobile" | "web" | "desktop";

export interface PluginNavItem {
  label: string;
  path: string;
  icon: string | ComponentType<{ className?: string }>;
  /** Optional badge count (e.g. pending requests) */
  badge?: () => number | null;
  platforms: PluginPlatform[];
}

/* ------------------------------------------------------------------ */
/*  Plugin configuration                                               */
/* ------------------------------------------------------------------ */

export interface PluginConfig {
  pluginId: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Plugin registry entry (from registry.json)                         */
/* ------------------------------------------------------------------ */

export interface PluginRegistryVersion {
  version: string;
  minTentacleVersion: string;
  maxTentacleVersion: string | null;
  downloadUrl: string;
  checksum: string;
  changelog: string;
  releaseDate: string;
}

export interface PluginRegistryEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  repo: string;
  icon: string;
  latestVersion: string;
  versions: PluginRegistryVersion[];
  tags: string[];
  platforms: PluginPlatform[];
  category: string;
}

export interface PluginRegistryManifest {
  name: string;
  description: string;
  author: string;
  url: string;
  plugins: PluginRegistryEntry[];
}

/* ------------------------------------------------------------------ */
/*  Installed plugin metadata (stored server-side)                     */
/* ------------------------------------------------------------------ */

export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  sourceId: string;
  enabled: boolean;
  installedAt: string;
  configuredAt?: string;
  healthStatus: "healthy" | "error" | "disabled";
}

/* ------------------------------------------------------------------ */
/*  Plugin source (admin-configurable registries)                      */
/* ------------------------------------------------------------------ */

export interface PluginSource {
  id: string;
  name: string;
  url: string;
  official: boolean;
  enabled: boolean;
  addedAt: string;
}
