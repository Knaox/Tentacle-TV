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

/** Sessions gardées à la fois : la page (`Authorization`) et le moteur audio (`X-Emby-Token`) n'envoient pas les mêmes en-têtes. */
const MAX_SESSIONS = 4;

export class PluginManifests {
  private readonly cache = new Map<string, { at: number; manifests: Map<string, ClientFetchManifest> }>();
  private readonly loading = new Map<string, Promise<Map<string, ClientFetchManifest>>>();

  constructor(private readonly fetcher: Fetcher = (url, init) => fetch(url, init), private readonly now: () => number = Date.now) {}

  /** Le manifeste de `pluginId` sur ce serveur, `null` s'il n'en déclare pas (ou lecture impossible). */
  async of(session: ServerSession, pluginId: string): Promise<ClientFetchManifest | null> {
    const key = `${session.serverOrigin}\n${JSON.stringify(session.headers)}`;
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < TTL_MS) return hit.manifests.get(pluginId) ?? null;
    let pending = this.loading.get(key);
    if (!pending) {
      pending = this.load(session)
        .then((manifests) => {
          this.cache.delete(key);
          this.cache.set(key, { at: this.now(), manifests });
          while (this.cache.size > MAX_SESSIONS) this.cache.delete(this.cache.keys().next().value as string);
          return manifests;
        })
        .catch(() => new Map<string, ClientFetchManifest>())
        .finally(() => this.loading.delete(key));
      this.loading.set(key, pending);
    }
    return (await pending).get(pluginId) ?? null;
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
