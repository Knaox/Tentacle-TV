/**
 * La query d'une page d'extension, tenue DANS L'ADRESSE de l'hôte, sans recharger l'extension.
 *
 * L'iframe (sandbox, `blob:` ou origine des greffons) ne voit pas l'adresse de l'hôte : elle
 * reçoit sa query au montage (`__tentacle_env.query`). Jusqu'ici, la changer passait par
 * `navigate`, qui reconstruit tout le document — un rechargement complet à chaque clic. Ici :
 *
 *   - l'extension demande `__tentacle_bridge.setQuery("?tab=users")` → l'hôte pousse la query
 *     dans son adresse (une entrée d'historique : le retour arrière la défait) SANS refaire le
 *     document ;
 *   - une extension qui l'a fait « tient » sa query : un retour arrière, un lien vers la même page
 *     lui sont REDITS (`HOST_QUERY`, évènement `tentacle:hostquery` dans l'iframe) au lieu de la
 *     recharger. Une extension qui ne l'a jamais demandé garde l'ancien comportement (Vigie et son
 *     `?media=` : document refait) ;
 *   - la dernière query est retenue par page d'extension, sur l'appareil : rouverte sans query,
 *     la page reprend où on l'avait laissée.
 *
 * Générique (toute extension), fonction purement client : aucune capacité serveur. Le document
 * l'annonce par `__tentacle_env.querySync`. ⚠️ API PUBLIQUE des extensions : les noms des
 * messages, de la méthode, du champ et de l'évènement ne se renomment jamais.
 */

/** L'iframe → l'hôte : « mets cette query dans l'adresse ». */
export const SET_QUERY_MESSAGE = "SET_QUERY";
/** L'hôte → l'iframe : la query de l'adresse a changé (retour arrière, lien). */
export const HOST_QUERY_MESSAGE = "HOST_QUERY";
/** L'évènement que le pont émet sur la `window` de l'iframe (détail : la query). */
export const HOST_QUERY_EVENT = "tentacle:hostquery";

/** Clé de stockage de l'hôte (JSON `{ [chemin de la page] : query }`) : ne se renomme jamais. */
export const PLUGIN_QUERY_STORAGE_KEY = "tentacle_plugin_last_query";

const QUERY_MAX = 256;
const PAGES_MAX = 32;

/** Une query acceptable : vide, ou `?…` court, sans fragment ni retour à la ligne. */
export function sanitizePluginQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "" || value === "?") return "";
  if (!value.startsWith("?") || value.length > QUERY_MAX || /[#\s]/.test(value)) return null;
  return value;
}

/** Le message `SET_QUERY` de l'iframe → la query, ou `null` s'il est mal formé. */
export function parseSetQuery(data: unknown): string | null {
  if (!data || typeof data !== "object" || (data as { type?: unknown }).type !== SET_QUERY_MESSAGE) return null;
  return sanitizePluginQuery((data as { query?: unknown }).query);
}

interface QueryStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function readAll(store: QueryStore): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(store.getItem(PLUGIN_QUERY_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** La dernière query retenue pour cette page d'extension (`null` : jamais tenue, ou vide). */
export function rememberedPluginQuery(pagePath: string, store: QueryStore | null = safeStorage()): string | null {
  if (!store) return null;
  const query = sanitizePluginQuery(readAll(store)[pagePath]);
  return query ? query : null;
}

/** Retient la query de la page (bornée : quelques pages, jamais une liste qui grossit). */
export function rememberPluginQuery(pagePath: string, query: string, store: QueryStore | null = safeStorage()): void {
  if (!store) return;
  const all = readAll(store);
  delete all[pagePath];
  all[pagePath] = query;
  const kept = Object.entries(all).slice(-PAGES_MAX);
  try {
    store.setItem(PLUGIN_QUERY_STORAGE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Stockage plein ou refusé : la page s'ouvrira simplement sans sa query.
  }
}

function safeStorage(): QueryStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** La query du document au montage : celle de l'adresse, sinon la dernière retenue. */
export const initialDocumentQuery = (search: string, remembered: string | null): string => search || remembered || "";

/** Script du pont : la méthode `setQuery` de `__tentacle_bridge`. */
export function buildQuerySyncBridgeMethod(): string {
  return `
      // La query de la page dans l'adresse de l'hôte, sans recharger l'extension (pluginQuerySync.ts).
      setQuery: function(query) {
        parent.postMessage({ type: ${JSON.stringify(SET_QUERY_MESSAGE)}, query: String(query || "") }, "*");
      }`;
}

/** Script du pont (dans l'écouteur `message`, `e` et `data` en portée) : la query redite par l'hôte. */
export function buildQuerySyncListener(): string {
  return `
      if (data.type === ${JSON.stringify(HOST_QUERY_MESSAGE)} && e.source === parent && typeof data.query === "string") {
        window.__tentacle_env.query = data.query;
        try { window.dispatchEvent(new CustomEvent(${JSON.stringify(HOST_QUERY_EVENT)}, { detail: data.query })); } catch (err) {}
      }`;
}
