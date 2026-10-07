/**
 * L'ÉCRAN À ROUVRIR après un rechargement de l'interface (changement du mode
 * Lite) : la pile d'écrans, réduite à ses noms et paramètres, gardée par le
 * natif le temps du rechargement. Ce qui ne s'écrit pas en JSON, ou une pile
 * trop lourde, ne se garde pas : l'app repart alors de son accueil, comme à
 * un lancement — jamais un écran rouvert à moitié.
 */

export interface ReloadRoute {
  name: string;
  params?: Record<string, unknown>;
}

export interface ReloadReturn {
  index: number;
  routes: ReloadRoute[];
}

/** La forme d'un état de navigation (React Navigation) dont on lit la pile. */
export interface NavigationStateLike {
  routes: ReadonlyArray<{ name: string; params?: object }>;
}

/** Au-delà, la pile ne se garde pas (une préférence native, pas un fichier). */
export const RELOAD_RETURN_MAX_CHARS = 8_000;

/**
 * La pile à garder ; `topParams` complète les paramètres de l'écran du dessus
 * (un état local qui doit survivre : l'onglet ouvert des Réglages). `null` :
 * rien à rouvrir.
 */
export function serializeReloadReturn(state: NavigationStateLike | undefined, topParams?: Record<string, unknown>): string | null {
  if (!state?.routes.length) return null;
  const last = state.routes.length - 1;
  const routes: ReloadRoute[] = state.routes.map((route, i) => {
    const params = i === last && topParams ? { ...(route.params ?? {}), ...topParams } : route.params;
    return params ? { name: route.name, params: params as Record<string, unknown> } : { name: route.name };
  });
  try {
    const json = JSON.stringify({ index: last, routes });
    return json.length <= RELOAD_RETURN_MAX_CHARS ? json : null;
  } catch {
    return null;
  }
}

/** La pile gardée, relue ; `null` si elle est absente ou illisible. */
export function parseReloadReturn(raw: string | null | undefined): ReloadReturn | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ReloadReturn>;
    const routes = Array.isArray(value.routes) ? value.routes : [];
    if (!routes.length || !routes.every((r) => r && typeof r.name === "string" && r.name.length > 0)) return null;
    if (routes.some((r) => r.params !== undefined && (typeof r.params !== "object" || r.params === null))) return null;
    return { index: routes.length - 1, routes: routes.map((r) => (r.params ? { name: r.name, params: r.params } : { name: r.name })) };
  } catch {
    return null;
  }
}
