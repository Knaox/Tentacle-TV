import { useMutation, useQuery } from "@tanstack/react-query";
import { readPluginSetupMeta, type PluginSetupResult, type PluginSetupState } from "@tentacle-tv/shared";
import { BACKEND, creds, hdrs } from "../../../pages/adminUtils";
import { PLUGIN_QUERY_ROOT } from "../../admin-plugins/queries";

/**
 * Le formulaire `setup` d'une extension, côté client : ce qui est déjà posé,
 * le test, et l'enregistrement qui l'active. Sous la racine du cache des
 * plugins : un geste de la page Plugins (mise à jour, désinstallation) le relit.
 */

export const pluginSetupKey = (pluginId: string) => [...PLUGIN_QUERY_ROOT, "setup", pluginId] as const;

/** Un refus du serveur : le champ en cause pour `invalid-field`. */
export class PluginSetupError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly field: string | null,
    readonly reason: string | null,
  ) {
    super(code ?? `HTTP ${String(status)}`);
  }
}

type Json = Record<string, unknown>;
const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): Record<string, string> =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};

async function call(pluginId: string, path: string, body?: object): Promise<unknown> {
  const headers = hdrs();
  if (body === undefined) delete headers["Content-Type"];
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/plugins/${encodeURIComponent(pluginId)}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      credentials: creds(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new PluginSetupError(0, "network", null, null);
  }
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const payload = isRecord(raw) ? raw : {};
    const text = (value: unknown) => (typeof value === "string" ? value : null);
    throw new PluginSetupError(res.status, text(payload.error), text(payload.field), text(payload.reason));
  }
  return raw;
}

function readState(raw: unknown): PluginSetupState | null {
  if (!isRecord(raw)) return null;
  const setup = readPluginSetupMeta(raw.setup);
  if (!setup) return null;
  const secrets = isRecord(raw.secrets)
    ? Object.fromEntries(Object.entries(raw.secrets).map(([key, value]) => [key, value === true]))
    : {};
  return { setup, values: strings(raw.values), secrets, configured: raw.configured === true, enabled: raw.enabled === true };
}

function readResult(raw: unknown): PluginSetupResult {
  const r = isRecord(raw) ? raw : {};
  return {
    ok: r.ok === true,
    error: typeof r.error === "string" ? r.error : null,
    version: typeof r.version === "string" ? r.version : null,
    saved: r.saved === true,
  };
}

export function usePluginSetupState(pluginId: string) {
  return useQuery({
    queryKey: pluginSetupKey(pluginId),
    queryFn: async () => {
      const state = readState(await call(pluginId, "/setup"));
      if (!state) throw new PluginSetupError(200, "unreadable", null, null);
      return state;
    },
    staleTime: 0,
    retry: false,
  });
}

/** `save` : le serveur teste, puis enregistre et active si le test réussit. */
export function usePluginSetupAction(pluginId: string, save: boolean) {
  return useMutation({
    mutationFn: async (values: Record<string, string>) =>
      readResult(await call(pluginId, save ? "/setup" : "/setup/test", { values })),
  });
}
