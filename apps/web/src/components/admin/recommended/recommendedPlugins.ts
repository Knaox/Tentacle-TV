import { Compass, type LucideIcon } from "lucide-react";
import type { InstalledPlugin, MarketplacePlugin } from "../../admin-plugins/types";

/**
 * Les extensions que la vue d'ensemble recommande, et où chacune en est sur
 * ce serveur — en logique pure. Rien ici ne sait ce que fait une extension :
 * l'état se lit dans la liste des plugins installés et dans le catalogue, les
 * mots dans `adminRecommended` (`rec_<pluginId>_*`), le formulaire dans son
 * manifeste.
 */

export interface RecommendedPlugin {
  pluginId: string;
  /** Le nombre d'avantages listés (`rec_<pluginId>_benefit1…n`). */
  benefits: number;
  icon: LucideIcon;
}

export const RECOMMENDED_PLUGINS: readonly RecommendedPlugin[] = [{ pluginId: "seer", benefits: 3, icon: Compass }];

export type RecommendedStatus =
  | { kind: "loading" }
  | { kind: "catalog-error" }
  | { kind: "not-found" }
  | { kind: "missing"; entry: MarketplacePlugin }
  | { kind: "disabled"; plugin: InstalledPlugin }
  | { kind: "restart"; plugin: InstalledPlugin }
  | { kind: "failed"; plugin: InstalledPlugin }
  | { kind: "setup"; plugin: InstalledPlugin }
  | { kind: "ready"; plugin: InstalledPlugin };

interface Lists {
  installed: InstalledPlugin[] | undefined;
  catalog: MarketplacePlugin[] | undefined;
  catalogFailed: boolean;
}

/**
 * Installé ou non, actif ou non, chargé ou non, branché ou non — dans cet
 * ordre : un plugin coupé n'a pas à dire qu'il attend un redémarrage, et un
 * plugin dont le module serveur ne tourne pas ne peut pas encore se tester.
 * Branché = son intégration active (`config.enabled`), la convention que
 * `/api/plugins/active` lit déjà (`configEnabled`).
 */
export function recommendedStatus(pluginId: string, { installed, catalog, catalogFailed }: Lists): RecommendedStatus {
  if (!installed) return { kind: "loading" };
  const plugin = installed.find((candidate) => candidate.pluginId === pluginId);
  if (!plugin) {
    if (catalog === undefined) return catalogFailed ? { kind: "catalog-error" } : { kind: "loading" };
    const entry = catalog.find((candidate) => candidate.pluginId === pluginId);
    return entry ? { kind: "missing", entry } : { kind: "not-found" };
  }
  if (!plugin.enabled) return { kind: "disabled", plugin };
  if (plugin.serverModule?.state === "failed") return { kind: "failed", plugin };
  if (plugin.restartRequired) return { kind: "restart", plugin };
  return plugin.config?.enabled === true ? { kind: "ready", plugin } : { kind: "setup", plugin };
}

/** La page d'administration du plugin, s'il en déclare une (convention `/admin/plugins/<id>`). */
export function adminPathOf(plugin: InstalledPlugin): string | null {
  return plugin.navItems?.some((item) => item.admin) ? `/admin/plugins/${plugin.pluginId}` : null;
}

/** Sa page principale, pour « Ouvrir » une fois branché. */
export function mainPathOf(plugin: InstalledPlugin): string | null {
  return plugin.navItems?.find((item) => !item.admin && item.platforms.includes("web"))?.path ?? null;
}
