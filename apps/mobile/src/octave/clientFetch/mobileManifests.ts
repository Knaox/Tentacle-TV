/**
 * Octave (mobile) — les hôtes que chaque extension DÉCLARE (`runtime.clientFetch` : `hosts` qu'elle fait
 * joindre, `mediaHosts` dont l'appareil lit un flux direct), lus par l'app elle-même sur le serveur
 * (`/api/plugins/active`), jamais une liste venue d'un message. Gardés 5 minutes, puis RELUS EN FOND : un
 * clic ne paie jamais cette lecture (la liste d'avant sert pendant qu'elle se relit). Une lecture ratée ne
 * garde rien de nouveau : sans manifeste, la requête est refusée et l'extension passe par le serveur.
 */

import { readClientFetchManifest, type ClientFetchManifest } from "@tentacle-tv/shared/pluginClientFetch";

const TTL_MS = 5 * 60_000;

export class MobileManifests {
  private manifests: Map<string, ClientFetchManifest> | null = null;
  private at = 0;
  private loading: Promise<Map<string, ClientFetchManifest> | null> | null = null;

  constructor(private readonly load: () => Promise<unknown>, private readonly now: () => number = Date.now) {}

  /** Le manifeste de `pluginId`, `null` s'il n'en déclare pas (ou s'il n'a jamais pu être lu). */
  async of(pluginId: string): Promise<ClientFetchManifest | null> {
    if (this.manifests === null) return (await this.refresh())?.get(pluginId) ?? null;
    if (this.now() - this.at >= TTL_MS) void this.refresh();
    return this.manifests.get(pluginId) ?? null;
  }

  /** Lire d'avance (agent démarré) : le premier clic n'attend pas la liste. */
  warm(): void {
    if (this.manifests === null || this.now() - this.at >= TTL_MS) void this.refresh();
  }

  /** Un autre compte, un autre serveur : tout se relit. */
  reset(): void {
    this.manifests = null;
    this.at = 0;
  }

  private refresh(): Promise<Map<string, ClientFetchManifest> | null> {
    this.loading ??= this.load()
      .then((list) => {
        const out = new Map<string, ClientFetchManifest>();
        for (const entry of Array.isArray(list) ? list : []) {
          const e = entry as { pluginId?: unknown; clientFetch?: unknown } | null;
          const manifest = e && typeof e.pluginId === "string" ? readClientFetchManifest(e.clientFetch) : null;
          if (manifest && e && typeof e.pluginId === "string") out.set(e.pluginId, manifest);
        }
        this.manifests = out;
        this.at = this.now();
        return out;
      })
      .catch(() => this.manifests)
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }
}
