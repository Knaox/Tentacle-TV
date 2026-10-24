/**
 * Les hôtes que chaque extension DÉCLARE (`runtime.clientFetch`), lus par le
 * principal LUI-MÊME sur le serveur réglé (`/api/plugins/active`, avec le jeton
 * de la session) — jamais une liste venue de la page. Gardés 5 minutes ; une
 * lecture ratée ne garde rien (la requête est refusée, l'extension passe par
 * le serveur).
 */

import { readClientFetchManifest, type ClientFetchManifest } from "./pluginClientFetch";

const TTL_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 5_000;

export interface ServerSession {
  /** L'origine du serveur Tentacle (`https://tentacle.example`). */
  serverOrigin: string;
  /** Les en-têtes d'authentification de la page (`Authorization`, `X-Emby-Token`). */
  headers: Record<string, string>;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export class PluginManifests {
  private cache: { key: string; at: number; manifests: Map<string, ClientFetchManifest> } | null = null;
  private loading: Promise<Map<string, ClientFetchManifest>> | null = null;

  constructor(private readonly fetcher: Fetcher = (url, init) => fetch(url, init), private readonly now: () => number = Date.now) {}

  /** Le manifeste de `pluginId` sur ce serveur, `null` s'il n'en déclare pas (ou lecture impossible). */
  async of(session: ServerSession, pluginId: string): Promise<ClientFetchManifest | null> {
    const key = `${session.serverOrigin}\n${JSON.stringify(session.headers)}`;
    if (this.cache && this.cache.key === key && this.now() - this.cache.at < TTL_MS) return this.cache.manifests.get(pluginId) ?? null;
    this.loading ??= this.load(session)
      .then((manifests) => {
        this.cache = { key, at: this.now(), manifests };
        return manifests;
      })
      .catch(() => new Map<string, ClientFetchManifest>())
      .finally(() => {
        this.loading = null;
      });
    return (await this.loading).get(pluginId) ?? null;
  }

  /** Un flux direct : l'hôte est-il dans les `mediaHosts` de cette extension ? (cache seulement, jamais d'attente réseau longue) */
  async mediaHosts(session: ServerSession, pluginId: string): Promise<string[]> {
    return (await this.of(session, pluginId))?.mediaHosts ?? [];
  }

  private async load(session: ServerSession): Promise<Map<string, ClientFetchManifest>> {
    const url = new URL("/api/plugins/active", session.serverOrigin).href;
    const res = await this.fetcher(url, { headers: session.headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`plugins/active ${res.status}`);
    const list = (await res.json()) as unknown;
    const out = new Map<string, ClientFetchManifest>();
    for (const entry of Array.isArray(list) ? list : []) {
      const e = entry as { pluginId?: unknown; clientFetch?: unknown } | null;
      const manifest = e && typeof e.pluginId === "string" ? readClientFetchManifest(e.clientFetch) : null;
      if (manifest && e && typeof e.pluginId === "string") out.set(e.pluginId, manifest);
    }
    return out;
  }
}
