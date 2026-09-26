import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pluginApi } from "./pluginApi";
import { describePluginError, type PluginErrorDescription } from "./pluginErrors";
import { PLUGIN_QUERY_ROOT } from "./queries";
import type { PluginSource } from "./types";

export interface SourceActionState {
  kind: "toggleSource" | "removeSource";
  status: "busy" | "error";
  error?: PluginErrorDescription;
}

/**
 * Les gestes sur les sources, chacun avec son état, par source — le même
 * principe que les plugins. Une source qui change change le catalogue : tout
 * se relit après coup.
 */
export function useSourceActions() {
  const queryClient = useQueryClient();
  const [states, setStates] = useState<ReadonlyMap<string, SourceActionState>>(new Map());

  const setState = useCallback((id: string, state: SourceActionState | null) => {
    setStates((prev) => {
      const next = new Map(prev);
      if (state) next.set(id, state);
      else next.delete(id);
      return next;
    });
  }, []);

  const run = useCallback(async (source: PluginSource, kind: SourceActionState["kind"], call: () => Promise<unknown>) => {
    setState(source.id, { kind, status: "busy" });
    try {
      await call();
      setState(source.id, null);
      await queryClient.invalidateQueries({ queryKey: PLUGIN_QUERY_ROOT });
      return true;
    } catch (error) {
      setState(source.id, { kind, status: "error", error: describePluginError(error) });
      return false;
    }
  }, [queryClient, setState]);

  const toggle = useCallback((source: PluginSource) =>
    run(source, "toggleSource", () => pluginApi(`/sources/${source.id}/toggle`, { method: "PUT" })), [run]);

  const remove = useCallback((source: PluginSource) =>
    run(source, "removeSource", () => pluginApi(`/sources/${source.id}`, { method: "DELETE" })), [run]);

  /** L'ajout lève son erreur : c'est le formulaire qui la montre, pas une ligne. */
  const add = useCallback(async (body: { url: string; name?: string }) => {
    const source = await pluginApi<PluginSource>("/sources", { method: "POST", body: JSON.stringify(body) });
    await queryClient.invalidateQueries({ queryKey: PLUGIN_QUERY_ROOT });
    return source;
  }, [queryClient]);

  return useMemo(() => ({ states, toggle, remove, add }), [states, toggle, remove, add]);
}
