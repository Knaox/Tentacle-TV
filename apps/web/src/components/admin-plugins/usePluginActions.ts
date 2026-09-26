import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { unregisterPlugin, useRefreshPlugins } from "@tentacle-tv/plugins-api";
import { pluginApi } from "./pluginApi";
import { describePluginError, type PluginErrorDescription } from "./pluginErrors";
import { PLUGIN_QUERY_ROOT } from "./queries";
import type { InstalledPlugin, MarketplacePlugin, RestartInfo } from "./types";

/**
 * Les gestes de la page, chacun avec SON état, rangé par identifiant de
 * plugin. L'ancienne page n'avait qu'un `isPending` par sorte de geste :
 * « Mettre à jour » sur une ligne désactivait et renommait toutes les lignes,
 * et un échec ne s'affichait nulle part.
 *
 * `mutateAsync` et une table d'états plutôt qu'un `useMutation` par geste : les
 * rappels d'une mutation ne répondent que pour son DERNIER appel (cf. la page
 * des sessions), or deux plugins peuvent être en vol en même temps.
 */

export type PluginActionKind = "install" | "update" | "uninstall" | "toggle" | "restart";

export interface PluginActionState {
  kind: PluginActionKind;
  status: "busy" | "done" | "error";
  error?: PluginErrorDescription;
}

/** L'entrée du redémarrage demandé à la main, dans la même table. */
export const SERVER_KEY = "__server__";

/** Assez pour lire la coche de réussite, pas assez pour qu'elle traîne. */
const DONE_VISIBLE_MS = 2500;

/** Les gestes qui peuvent redémarrer le serveur : un seul à la fois. */
const HEAVY: ReadonlySet<PluginActionKind> = new Set(["install", "update", "uninstall", "restart"]);

export interface PluginActions {
  states: ReadonlyMap<string, PluginActionState>;
  /** Un geste lourd est en vol : les autres attendent (le serveur peut redémarrer au bout). */
  heavyBusy: boolean;
  install: (entry: MarketplacePlugin) => Promise<boolean>;
  update: (target: { id: string; pluginId: string; name: string }) => Promise<boolean>;
  uninstall: (plugin: InstalledPlugin) => Promise<boolean>;
  toggle: (plugin: InstalledPlugin) => Promise<boolean>;
  restartServer: () => Promise<boolean>;
  clear: (key: string) => void;
}

export function usePluginActions(
  onRestartScheduled: (bootId: string | undefined, label: string | null) => void,
  onSuccess?: (kind: PluginActionKind, label: string | null) => void,
): PluginActions {
  const queryClient = useQueryClient();
  const refreshPlugins = useRefreshPlugins();
  const [states, setStates] = useState<ReadonlyMap<string, PluginActionState>>(new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const callbacks = useRef({ onRestartScheduled, onSuccess });
  callbacks.current = { onRestartScheduled, onSuccess };

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const setState = useCallback((key: string, state: PluginActionState | null) => {
    const timer = timers.current.get(key);
    if (timer) clearTimeout(timer);
    timers.current.delete(key);
    setStates((prev) => {
      const next = new Map(prev);
      if (state) next.set(key, state);
      else next.delete(key);
      return next;
    });
    if (state?.status === "done") {
      timers.current.set(key, setTimeout(() => setState(key, null), DONE_VISIBLE_MS));
    }
  }, []);

  const run = useCallback(async <T,>(
    key: string,
    kind: PluginActionKind,
    label: string | null,
    call: () => Promise<T>,
    after?: (result: T) => void,
  ): Promise<boolean> => {
    setState(key, { kind, status: "busy" });
    try {
      const result = await call();
      after?.(result);
      // Une bascule ne se salue pas : l'interrupteur a déjà changé de côté.
      setState(key, kind === "toggle" ? null : { kind, status: "done" });
      // Les routes, la navigation et les pages des plugins suivent aussitôt,
      // sans attendre le prochain rafraîchissement de la liste des actifs.
      refreshPlugins();
      void queryClient.invalidateQueries({ queryKey: PLUGIN_QUERY_ROOT });
      const restart = result as RestartInfo | null;
      if (restart?.restartScheduled) callbacks.current.onRestartScheduled(restart.bootId, label);
      // « Already up to date » : rien n'a été posé, rien ne s'annonce.
      const unchanged = kind === "update" && typeof (result as { message?: unknown } | null)?.message === "string";
      if (!unchanged) callbacks.current.onSuccess?.(kind, label);
      return true;
    } catch (error) {
      setState(key, { kind, status: "error", error: describePluginError(error) });
      return false;
    }
  }, [queryClient, refreshPlugins, setState]);

  const install = useCallback((entry: MarketplacePlugin) =>
    run(entry.pluginId, "install", entry.name, () =>
      pluginApi<InstalledPlugin & RestartInfo>("/install", {
        method: "POST",
        body: JSON.stringify({ pluginId: entry.pluginId, version: entry.version, sourceId: entry.sourceId }),
      })), [run]);

  // Le bundle en mémoire est l'ancien : il se recharge à la prochaine visite.
  const update = useCallback((target: { id: string; pluginId: string; name: string }) =>
    run(target.pluginId, "update", target.name,
      () => pluginApi<RestartInfo>(`/${target.id}/update`, { method: "POST" }),
      () => unregisterPlugin(target.pluginId)), [run]);

  const uninstall = useCallback((plugin: InstalledPlugin) =>
    run(plugin.pluginId, "uninstall", plugin.name,
      () => pluginApi<RestartInfo>(`/${plugin.id}`, { method: "DELETE" }),
      () => unregisterPlugin(plugin.pluginId)), [run]);

  const toggle = useCallback((plugin: InstalledPlugin) =>
    run(plugin.pluginId, "toggle", plugin.name,
      () => pluginApi<InstalledPlugin>(`/${plugin.id}/toggle`, { method: "PUT" }),
      (result) => {
        if (!result.enabled) unregisterPlugin(plugin.pluginId);
      }), [run]);

  const restartServer = useCallback(() =>
    run(SERVER_KEY, "restart", null, () => pluginApi<RestartInfo>("/restart", { method: "POST" })), [run]);

  const clear = useCallback((key: string) => setState(key, null), [setState]);

  const heavyBusy = useMemo(
    () => [...states.values()].some((s) => s.status === "busy" && HEAVY.has(s.kind)),
    [states],
  );

  return useMemo(
    () => ({ states, heavyBusy, install, update, uninstall, toggle, restartServer, clear }),
    [states, heavyBusy, install, update, uninstall, toggle, restartServer, clear],
  );
}
