import type { NotificationExtensionTarget, NotificationItemTarget, NotificationTarget } from "./notificationTarget";
import { resolveNotificationRoute, type NotifPluginMeta } from "./notificationRoute";

/**
 * Où mène une notification, sur chaque client qui en ouvre une (cloche du web
 * et du bureau, miroir, cloche et push du mobile). La CIBLE posée par
 * l'émetteur passe d'abord ; sans cible — ou une cible que ce client ne sait
 * pas ouvrir (extension coupée, page retirée) —, la route d'avant, tirée du
 * type. Le cœur n'y connaît aucune extension : il ouvre la page qu'elle
 * désigne, avec les paramètres qu'elle a posés.
 */

export type NotificationPlatform = "web" | "mobile";

/** Cherche un titre dans la bibliothèque par son TMDB : l'identifiant Jellyfin, ou null. */
export type LibraryTitleLookup = (mediaType: "movie" | "tv", tmdbId: number) => Promise<string | null>;

/** La fiche d'un titre — même chemin sur le web, le bureau et le mobile. */
export function itemRoute(itemId: string): string {
  return `/media/${encodeURIComponent(itemId)}`;
}

function queryOf(params: Record<string, string> | undefined): string {
  const entries = Object.entries(params ?? {});
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

/** Le bureau sert le build web : ses pages d'extension se publient pour « web » ou « desktop ». */
function publishedOn(platforms: string[], platform: NotificationPlatform): boolean {
  return platform === "mobile" ? platforms.includes("mobile") : platforms.includes("web") || platforms.includes("desktop");
}

/**
 * La page d'extension, si l'extension est active ici et publie ce chemin pour
 * cette plateforme ; sinon null (la notification retombe sur son type).
 */
export function extensionRoute(
  target: NotificationExtensionTarget,
  platform: NotificationPlatform,
  plugins: NotifPluginMeta[] | undefined,
): string | null {
  const plugin = plugins?.find((p) => p.pluginId === target.pluginId);
  const nav = plugin?.navItems.find((n) => n.path === target.path && publishedOn(n.platforms, platform));
  if (!nav) return null;
  const query = queryOf(target.params);
  if (platform === "web") return `${target.path}${query}`;
  // Mobile : l'écran d'une page d'extension, qui transmet la query à la WebView.
  const params = new URLSearchParams({ path: target.path, ...(query ? { query } : {}) });
  return `/plugin/${encodeURIComponent(target.pluginId)}?${params.toString()}`;
}

function leafRoute(
  target: NotificationItemTarget | NotificationExtensionTarget,
  platform: NotificationPlatform,
  plugins: NotifPluginMeta[] | undefined,
): string | null {
  return target.kind === "item" ? itemRoute(target.itemId) : extensionRoute(target, platform, plugins);
}

/**
 * La route d'une cible sans aller-retour réseau : `undefined` quand il faut
 * chercher le titre (cible `title`), `null` quand la cible n'ouvre rien ici.
 */
export function immediateTargetRoute(
  target: NotificationTarget,
  platform: NotificationPlatform,
  plugins: NotifPluginMeta[] | undefined,
): string | null | undefined {
  return target.kind === "title" ? undefined : leafRoute(target, platform, plugins);
}

/** La notification mène-t-elle quelque part ? (sans réseau : une cible `title` mène toujours). */
export function notificationHasDestination(
  n: { type: string; refId: string | null; target?: NotificationTarget | null },
  platform: NotificationPlatform,
  plugins: NotifPluginMeta[] | undefined,
): boolean {
  if (n.target && immediateTargetRoute(n.target, platform, plugins) !== null) return true;
  return resolveNotificationRoute(n, platform, plugins) !== null;
}

/**
 * La destination complète : la cible (titre cherché au besoin), puis son
 * repli, puis la route d'avant. Une recherche qui échoue (réseau) ne bloque
 * jamais : on passe au repli.
 */
export async function resolveNotificationDestination(
  n: { type: string; refId: string | null; target?: NotificationTarget | null },
  platform: NotificationPlatform,
  plugins: NotifPluginMeta[] | undefined,
  lookupTitle: LibraryTitleLookup,
): Promise<string | null> {
  const target = n.target;
  if (target) {
    if (target.kind !== "title") {
      const route = leafRoute(target, platform, plugins);
      if (route) return route;
    } else {
      const itemId = await lookupTitle(target.mediaType, target.tmdbId).catch(() => null);
      if (itemId) return itemRoute(itemId);
      const fallback = target.fallback ? leafRoute(target.fallback, platform, plugins) : null;
      if (fallback) return fallback;
    }
  }
  return resolveNotificationRoute(n, platform, plugins);
}
