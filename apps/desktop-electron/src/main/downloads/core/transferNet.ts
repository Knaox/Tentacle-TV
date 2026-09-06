/**
 * Le réseau du transfert de média, vu par le cœur.
 *
 * Deux méthodes, pas plus : ouvrir un flux, arrêter un transcodage. C'est ce
 * que le pilote de flux (`node/streamDriver.ts`) consomme ; l'implémentation
 * réelle vit sur chaque plateforme (`electronTransferNet.ts` sur le bureau,
 * un flux simulé dans les tests).
 *
 * ⚠️ L'authentification n'est PAS la même que pour le snapshot. Ces URL sont
 * des routes du backend Tentacle (`/api/downloads/*`), qui attendent un
 * `Authorization: Bearer`. Les URL du snapshot passent par le proxy
 * `/api/jellyfin` et veulent `X-Emby-Token` — un Bearer y ferait un 401 muet.
 * Chaque appelant fournit donc ses propres en-têtes.
 */

/** Un flux ouvert, réduit à ce que le pilote lit. */
export interface TransferStream {
  status: number;
  header(name: string): string | null;
  chunks: AsyncIterable<Uint8Array>;
}

export interface TransferNet {
  open(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<TransferStream>;
  /** Arrêt de transcodage, best-effort : ne lève jamais. */
  killTranscode(url: string, headers: Record<string, string>): Promise<void>;
}
