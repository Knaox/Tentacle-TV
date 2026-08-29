/**
 * Le réseau du transfert de média, et son implémentation réelle.
 *
 * Séparé de `transfer.ts` pour la même raison que partout ailleurs dans cette
 * couche : la boucle de transfert porte la reprise, le contrôle d'intégrité et
 * la classification des erreurs — tout cela se teste, à condition que le flux
 * entre par la porte. Côté Rust, `transfer.rs` n'avait aucun test.
 *
 * ⚠️ L'authentification n'est PAS la même que pour le snapshot. Ces URL sont
 * des routes du backend Tentacle (`/api/downloads/*`), qui attendent un
 * `Authorization: Bearer`. Les URL du snapshot passent par le proxy
 * `/api/jellyfin` et veulent `X-Emby-Token` — un Bearer y ferait un 401 muet.
 * Chaque appelant fournit donc ses propres en-têtes.
 */

import { net } from "electron";

/** Un flux ouvert, réduit à ce que la boucle de transfert lit. */
export interface TransferStream {
  status: number;
  header(name: string): string | null;
  chunks: AsyncIterable<Uint8Array>;
}

export interface TransferNet {
  open(
    url: string,
    headers: Record<string, string>,
    signal: AbortSignal,
  ): Promise<TransferStream>;
  /** Arrêt de transcodage, best-effort : ne lève jamais. */
  killTranscode(url: string, headers: Record<string, string>): Promise<void>;
}

/** L'implémentation réelle, par la pile réseau de Chromium. */
export const electronTransferNet: TransferNet = {
  async open(url, headers, signal) {
    const response = await net.fetch(url, { headers, signal });
    return {
      status: response.status,
      header: (name) => response.headers.get(name),
      chunks: chunks(response),
    };
  },

  async killTranscode(url, headers) {
    try {
      await net.fetch(url, { method: "DELETE", headers });
    } catch {
      // Le serveur libérera de lui-même à l'expiration de la session.
    }
  },
};

/**
 * Les blocs du corps, en itérable asynchrone.
 *
 * `response.body` est un `ReadableStream` du DOM : il n'est pas itérable dans
 * toutes les versions, alors que son lecteur l'est toujours. Un corps absent
 * donne une suite vide, que la boucle traite comme un fichier de zéro octet —
 * donc un échec d'intégrité, ce qui est le verdict juste.
 */
async function* chunks(response: Response): AsyncIterable<Uint8Array> {
  const body = response.body;
  if (body === null) return;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value !== undefined) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
