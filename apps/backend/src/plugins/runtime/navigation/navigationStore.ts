import type { PluginNavigationDoc } from "./pluginNavigation";

/**
 * Ce que chaque extension a réglé de sa navigation, gardé EN MÉMOIRE pour que
 * `/api/plugins/active` ne ralentisse jamais :
 *
 * - une valeur connue est servie AUSSITÔT ; vieillie (`REFRESH_AFTER_MS`), elle
 *   se relit en fond, sans attendre ;
 * - la toute première lecture, et celle qui suit une ÉCRITURE de l'extension
 *   (`invalidate`, posé par le relais), s'attendent `WAIT_MS` au plus — un
 *   invité lent ou muet ne retarde jamais `/active` au-delà ; la lecture
 *   continue alors en fond et sert la requête suivante ;
 * - un échec garde la dernière valeur connue (sinon `null` : comportement
 *   d'avant). Jamais deux lectures à la fois pour une extension.
 *
 * Module pur : la lecture (`fetch`) et l'horloge sont injectées.
 */

export const NAVIGATION_WAIT_MS = 1_000;
export const NAVIGATION_REFRESH_AFTER_MS = 10 * 60_000;

interface Entry {
  doc: PluginNavigationDoc | null;
  /** Quand la valeur a été lue ; `null` : jamais lue, ou à relire d'urgence (écriture). */
  readAt: number | null;
  /** Ce que la route déclarée valait à la dernière lecture : seule son écriture invalide. */
  route: string;
  inflight: Promise<void> | null;
  /** Écrite PENDANT une lecture : celle-ci a pu partir avant l'écriture, on relira derrière. */
  stale: boolean;
  /**
   * La fin de la fenêtre d'attente (première lecture, ou après une écriture) : toutes les requêtes
   * de la fenêtre la partagent, aucune n'attend au-delà ; `null` : pas encore ouverte.
   */
  waitUntil: number | null;
}

export interface NavigationStoreDeps {
  fetch: (pluginId: string, route: string) => Promise<PluginNavigationDoc | null>;
  now?: () => number;
  waitMs?: number;
  refreshAfterMs?: number;
}

export function createNavigationStore(deps: NavigationStoreDeps) {
  const now = deps.now ?? Date.now;
  const waitMs = deps.waitMs ?? NAVIGATION_WAIT_MS;
  const refreshAfterMs = deps.refreshAfterMs ?? NAVIGATION_REFRESH_AFTER_MS;
  const entries = new Map<string, Entry>();

  const refresh = (pluginId: string, entry: Entry): Promise<void> => {
    if (entry.inflight) return entry.inflight;
    const run = deps
      .fetch(pluginId, entry.route)
      .then((doc) => {
        // Une réponse illisible garde la valeur d'avant : jamais une barre qui saute.
        if (doc) entry.doc = doc;
      })
      .catch(() => undefined)
      .finally(() => {
        entry.inflight = null;
        if (entry.stale) {
          entry.stale = false;
          void refresh(pluginId, entry);
        } else {
          entry.readAt = now();
        }
      });
    entry.inflight = run;
    return run;
  };

  /** Jusqu'à une valeur fraîche (relectures enchaînées comprises). */
  const fresh = async (pluginId: string, entry: Entry): Promise<void> => {
    while (entry.readAt === null) await refresh(pluginId, entry);
  };

  const settleWithin = async (pending: Promise<void>, ms: number): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([pending, new Promise<void>((done) => { timer = setTimeout(done, ms); })]);
    if (timer) clearTimeout(timer);
  };

  return {
    /** La navigation réglée par l'extension, dans la seconde au plus ; `null` si rien n'est connu. */
    async read(pluginId: string, route: string): Promise<PluginNavigationDoc | null> {
      let entry = entries.get(pluginId);
      if (!entry || entry.route !== route) {
        entry = { doc: null, readAt: null, route, inflight: null, stale: false, waitUntil: null };
        entries.set(pluginId, entry);
      }
      if (entry.readAt === null) {
        entry.waitUntil ??= now() + waitMs;
        const left = entry.waitUntil - now();
        if (left > 0) await settleWithin(fresh(pluginId, entry), left);
        else void fresh(pluginId, entry);
      } else if (now() - entry.readAt >= refreshAfterMs) {
        void refresh(pluginId, entry);
      }
      return entry.doc;
    },

    /** L'extension vient d'écrire `route` (relais, réponse 2xx) : la prochaine lecture va la chercher. */
    invalidate(pluginId: string, route: string): void {
      const entry = entries.get(pluginId);
      if (!entry || entry.route !== route.split("?")[0]) return;
      entry.readAt = null;
      entry.waitUntil = null;
      if (entry.inflight) entry.stale = true;
      else void refresh(pluginId, entry);
    },

    /** L'invité a changé (relance, mise à jour, coupure) : on oublie tout de lui. */
    forget(pluginId: string): void {
      entries.delete(pluginId);
    },
  };
}

export type NavigationStore = ReturnType<typeof createNavigationStore>;
