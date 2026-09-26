import { searchScore } from "@tentacle-tv/shared";
import { isNewerVersion } from "../../lib/updateCheckers";
import type { InstalledPlugin, MarketplacePlugin } from "./types";

/**
 * La logique de la page Plugins, sans React : rapprocher un plugin installé
 * de son entrée au catalogue, chercher, classer, et ne jamais laisser un
 * registre tiers dicter une adresse dangereuse.
 *
 * Rapprochement par IDENTIFIANT, jamais par nom : le nom d'un plugin installé
 * n'est pas celui du catalogue — Vigie réécrit le sien avec le nom d'onglet
 * choisi par l'administrateur (« Demandes — Jellyseerr (unofficial) »).
 */

export function catalogIndex(entries: readonly MarketplacePlugin[] | undefined): Map<string, MarketplacePlugin> {
  return new Map((entries ?? []).map((entry) => [entry.pluginId, entry]));
}

/**
 * La version à laquelle un plugin installé peut passer, ou `null`.
 *
 * L'entrée doit venir de la source d'installation : c'est elle que la mise à
 * jour lit côté serveur. Un serveur d'avant 1.20 gardait la première source
 * qui publiait l'identifiant — une autre version que celle qui serait posée.
 */
export function availableUpdate(plugin: InstalledPlugin, entry: MarketplacePlugin | undefined): string | null {
  if (!entry || entry.sourceId !== plugin.sourceId) return null;
  return isNewerVersion(entry.version, plugin.version) ? entry.version : null;
}

interface Searchable {
  pluginId: string;
  name: string;
  description?: string;
  author?: string;
  tags?: string[];
  category?: string;
}

/** Un score retranché d'une pénalité de champ, sans qu'une vraie correspondance tombe à zéro. */
const weighted = (score: number, penalty: number) => (score > 0 ? Math.max(1, score - penalty) : 0);

/** Pertinence pour une recherche : le nom d'abord, puis l'identifiant, les mots-clés, l'auteur, la description. */
export function pluginSearchRank(entry: Searchable, query: string): number {
  const q = query.trim();
  if (!q) return 1;
  return Math.max(
    searchScore(entry.name, q),
    weighted(searchScore(entry.pluginId, q), 50),
    ...(entry.tags ?? []).map((tag) => weighted(searchScore(tag, q), 150)),
    weighted(searchScore(entry.category ?? "", q), 150),
    weighted(searchScore(entry.author ?? "", q), 200),
    weighted(searchScore(entry.description ?? "", q), 300),
  );
}

/** Les entrées qui répondent à la recherche, les plus pertinentes d'abord ; l'ordre d'origine sans recherche. */
export function searchCatalog<T extends Searchable>(entries: readonly T[], query: string): T[] {
  if (!query.trim()) return [...entries];
  return entries
    .map((entry, index) => ({ entry, index, rank: pluginSearchRank(entry, query) }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((row) => row.entry);
}

/** Les catégories présentes, les plus fournies d'abord. */
export function catalogCategories(entries: readonly { category?: string }[]): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { category } of entries) {
    const id = category?.trim();
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/** « media-management » → « Media management » : le libellé d'une catégorie qu'aucune traduction ne connaît. */
export function humanizeSlug(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug;
}

/** Le catalogue par défaut : officiel d'abord, puis par nom. */
export function sortCatalog(entries: readonly MarketplacePlugin[]): MarketplacePlugin[] {
  return [...entries].sort((a, b) => Number(b.official) - Number(a.official) || a.name.localeCompare(b.name));
}

/** Une adresse http(s) absolue, ou rien : un registre tiers ne dicte pas un `javascript:`. */
export function safeHttpUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Le dépôt d'un plugin : « propriétaire/dépôt » (GitHub, la convention du registre) ou une adresse complète. */
export function repoLink(repo: string | undefined): { href: string; label: string } | null {
  const value = repo?.trim();
  if (!value) return null;
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return { href: `https://github.com/${value}`, label: value };
  const href = safeHttpUrl(value);
  if (!href) return null;
  const url = new URL(href);
  return { href, label: `${url.host}${url.pathname}`.replace(/\/$/, "") };
}

/** L'image publiée par le registre (http(s) ou data:image) ; le reste retombe sur le monogramme. */
export function iconImageUrl(icon: string | undefined): string | null {
  const value = icon?.trim();
  if (!value) return null;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(value)) return value;
  return safeHttpUrl(value);
}

/** L'initiale d'un nom pour le monogramme : sa première lettre ou son premier chiffre. */
export function monogram(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : "?";
}

/** L'icône Lucide que le plugin affiche dans la navigation — la même sur sa carte. */
export function navIconName(plugin: Pick<InstalledPlugin, "navItems">): string | null {
  const items = plugin.navItems ?? [];
  return (items.find((item) => !item.admin) ?? items[0])?.icon ?? null;
}

/**
 * Où « Configurer » mène : la page d'administration que le plugin déclare
 * pour le web, sinon sa page par convention s'il porte un bundle.
 */
export function configRoute(plugin: Pick<InstalledPlugin, "pluginId" | "navItems" | "hasBundle">): string | null {
  const adminNav = plugin.navItems?.find((item) => item.admin && item.platforms?.includes("web"));
  if (adminNav) return adminNav.path;
  return plugin.hasBundle ? `/admin/plugins/${plugin.pluginId}` : null;
}

/**
 * « il y a 5 minutes », « hier » : l'âge d'une lecture de registre, en clair
 * (`Intl.RelativeTimeFormat`, de la seconde au jour). `null` pour une date
 * illisible ; une date future (horloges décalées) vaut « maintenant ».
 */
export function relativeTime(iso: string, now: number, locale: string): string | null {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const seconds = Math.min(0, Math.round((at - now) / 1000));
  if (seconds > -60) return format.format(0, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes > -60) return format.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}
