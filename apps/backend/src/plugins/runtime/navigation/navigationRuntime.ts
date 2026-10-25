import { createGuestNavigationFetch, type GuestSocketLookup } from "./navigationFetch";
import { createNavigationStore } from "./navigationStore";
import { mergeNavigation, type PluginNavigationDoc } from "./pluginNavigation";

/**
 * Le magasin de navigation du serveur, un seul (capacité `plugins.navigation`).
 * L'accès aux invités est BRANCHÉ par `registerIsolatedRuntime` (index.ts) :
 * ce module n'importe pas le registre, que le registre importe pour oublier un
 * invité qui change. Non branché (tests, runtime absent) : aucune lecture.
 */

let lookup: GuestSocketLookup | null = null;

const store = createNavigationStore({
  fetch: (pluginId, route) => (lookup ? createGuestNavigationFetch(lookup)(pluginId, route) : Promise.resolve(null)),
});

export function configureNavigationLookup(next: GuestSocketLookup | null): void {
  lookup = next;
}

/** Les `navItems` d'une extension, avec ce qu'elle a réglé ; sans route déclarée, tels quels, sans appel. */
export async function withPluginNavigation<T extends { path: string; admin?: unknown }>(
  pluginId: string,
  route: string | null,
  navItems: readonly T[],
): Promise<Array<T & { primary?: boolean }>> {
  if (!route || !navItems.some((nav) => !nav.admin)) return [...navItems];
  const doc: PluginNavigationDoc | null = await store.read(pluginId, route);
  return mergeNavigation(navItems, doc);
}

/** Le relais a laissé passer une écriture réussie vers `route` de l'extension. */
export function navigationWritten(pluginId: string, route: string): void {
  store.invalidate(pluginId, route);
}

/** L'invité change (arrêt, mise à jour) : rien de lui n'est gardé. */
export function forgetPluginNavigation(pluginId: string): void {
  store.forget(pluginId);
}
