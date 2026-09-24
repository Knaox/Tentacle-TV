/**
 * La recherche HORS bibliothèque, telle que les plugins la proposent — pur,
 * sans React. Un plugin qui déclare `search` dans son manifeste (relayé par
 * `/api/plugins/active`, cf. `pluginSearchMeta.ts` côté serveur) devient une
 * source de résultats : Tentacle l'interroge à la frappe et range ce qu'il
 * rend dans une section à part, sous le nom qu'il a choisi.
 *
 * Tentacle ne sait RIEN de ce que le plugin cherche ni d'où il le tient : il
 * valide la forme (titre, image, lien vers une page du plugin, pastille) et
 * l'affiche. Aucun plugin actif et configuré : aucune source, donc aucune
 * section — rien de ce qui n'est pas dans la bibliothèque n'apparaît.
 */

import { foldForSearch } from "./searchText";

/**
 * Ce que la recherche lit d'un plugin actif (`/api/plugins/active`) — la forme
 * d'`ActivePluginMeta` (plugins-api), réduite à ses champs utiles : le web et
 * le mobile y passent chacun leur liste, sans dépendre l'un de l'autre.
 */
export interface SearchablePlugin {
  pluginId: string;
  name: string;
  configEnabled?: boolean;
  search?: { path: string; person?: string; types?: readonly string[]; labels?: Record<string, string> };
}

export type ExternalKind = "movie" | "series";
export type ExternalTone = "neutral" | "info" | "success" | "warning";

export interface ExternalSearchItem {
  id: string;
  kind: ExternalKind;
  title: string;
  year: number | null;
  subtitle: string | null;
  imageUrl: string | null;
  /** Une route de Tentacle — la page du plugin qui montre ce titre. */
  href: string;
  badge: { label: string; tone: ExternalTone } | null;
}

export interface SearchProvider {
  pluginId: string;
  path: string;
  /** Route de la filmographie hors bibliothèque (`search.person`), sinon `null`. */
  personPath: string | null;
  types: ExternalKind[] | null;
  /** Le nom de la section : celui du manifeste, dans la langue de l'interface. */
  label: string;
  /** Le nom court du plugin, pour dire d'où viennent les résultats. */
  source: string;
}

export interface ExternalSearchResult {
  provider: SearchProvider;
  query: string;
  correction: string | null;
  /** Faux : le plugin a répondu vite avec ce qu'il avait, la suite arrive. */
  complete: boolean;
  items: ExternalSearchItem[];
  moreHref: string | null;
}

const MAX_ITEMS = 20;
/* Même garde que le serveur : un chemin simple, sous la racine du plugin. */
const SAFE_PATH = /^\/[A-Za-z0-9_\-/]{1,100}$/;

function isSafePath(value: unknown): value is string {
  return typeof value === "string" && SAFE_PATH.test(value) && !value.includes("//");
}

/** « Vigie — Jellyseerr (unofficial) » se présente comme « Vigie ». */
export function shortPluginName(name: string): string {
  return name.split(/\s+[—–-]\s+/)[0]?.trim() || name;
}

/** Les plugins actifs, configurés, qui savent chercher. */
export function searchProviders(
  plugins: readonly SearchablePlugin[],
  lang: string,
  fallbackLabel: string,
): SearchProvider[] {
  const out: SearchProvider[] = [];
  for (const plugin of plugins) {
    const search = plugin.configEnabled === true ? plugin.search : undefined;
    if (!search || !isSafePath(search.path)) continue;
    const types = Array.isArray(search.types)
      ? search.types.filter((t): t is ExternalKind => t === "movie" || t === "series")
      : [];
    out.push({
      pluginId: plugin.pluginId,
      path: search.path,
      personPath: isSafePath(search.person) ? search.person : null,
      types: types.length > 0 ? types : null,
      label: search.labels?.[lang] ?? search.labels?.en ?? fallbackLabel,
      source: shortPluginName(plugin.name),
    });
  }
  return out;
}

/** Ce plugin cherche-t-il ce type de titre ? */
export function providerAccepts(provider: SearchProvider, kind: ExternalKind | null): boolean {
  return kind === null || provider.types === null || provider.types.includes(kind);
}

export function providerUrl(
  provider: SearchProvider,
  query: string,
  options: { lang: string; limit: number; kind: ExternalKind | null },
): string {
  const params = new URLSearchParams({ q: query, lang: options.lang, limit: String(options.limit) });
  if (options.kind !== null) params.set("type", options.kind);
  return `/api/plugins/${encodeURIComponent(provider.pluginId)}${provider.path}?${params.toString()}`;
}

/** La filmographie d'une personne chez ce plugin : son nom, et son identifiant TMDB s'il est connu. */
export function personProviderUrl(
  provider: SearchProvider & { personPath: string },
  person: { name: string; tmdbId: string | null },
  options: { lang: string; limit: number },
): string {
  const params = new URLSearchParams({ name: person.name, lang: options.lang, limit: String(options.limit) });
  if (person.tmdbId !== null) params.set("tmdb", person.tmdbId);
  return `/api/plugins/${encodeURIComponent(provider.pluginId)}${provider.personPath}?${params.toString()}`;
}

/* Un lien interne, jamais un autre site : le plugin désigne une de ses pages. */
function safeHref(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && value.length <= 300
    ? value
    : null;
}

function safeImage(value: unknown): string | null {
  return typeof value === "string" && /^https?:\/\//i.test(value) && value.length <= 500 ? value : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;
}

const TONES: readonly ExternalTone[] = ["neutral", "info", "success", "warning"];

function toItem(raw: unknown): ExternalSearchItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = text(r.title, 200);
  const href = safeHref(r.href);
  const id = text(r.id, 100);
  if (title === null || href === null || id === null) return null;
  const badge = r.badge && typeof r.badge === "object" ? r.badge as Record<string, unknown> : null;
  const label = badge ? text(badge.label, 40) : null;
  return {
    id,
    kind: r.kind === "series" ? "series" : "movie",
    title,
    year: typeof r.year === "number" && Number.isFinite(r.year) ? r.year : null,
    subtitle: text(r.subtitle, 120),
    imageUrl: safeImage(r.imageUrl),
    href,
    badge: label !== null
      ? { label, tone: TONES.includes(badge?.tone as ExternalTone) ? (badge?.tone as ExternalTone) : "neutral" }
      : null,
  };
}

/** Une réponse de plugin, validée champ par champ. Illisible : `null`, la section se tait. */
export function readExternalResponse(raw: unknown, provider: SearchProvider): ExternalSearchResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items)) return null;
  const seen = new Set<string>();
  const items: ExternalSearchItem[] = [];
  for (const entry of r.items) {
    const item = toItem(entry);
    if (item === null || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= MAX_ITEMS) break;
  }
  return {
    provider,
    query: typeof r.query === "string" ? r.query : "",
    correction: text(r.correction, 120),
    complete: r.complete !== false,
    items,
    moreHref: safeHref(r.moreHref),
  };
}

/**
 * Ce que la bibliothèque a déjà ne se propose pas une seconde fois : même
 * titre (plié) et même année — le plugin le filtre déjà, ceci n'est qu'un
 * filet quand ses statuts ont un temps de retard sur la bibliothèque.
 */
export function withoutLibraryTwins(
  items: readonly ExternalSearchItem[],
  library: ReadonlyArray<{ name: string; year?: number | null }>,
): ExternalSearchItem[] {
  if (library.length === 0) return [...items];
  const owned = new Set(library.map((l) => `${foldForSearch(l.name)}|${l.year ?? ""}`));
  return items.filter((item) => !owned.has(`${foldForSearch(item.title)}|${item.year ?? ""}`));
}
