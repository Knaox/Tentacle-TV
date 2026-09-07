/**
 * Le réseau du transfert de média, par la pile réseau de Chromium.
 *
 * L'interface (`TransferNet`) vit dans le cœur ; ici, seulement l'implémentation
 * Electron — c'est l'un des deux seuls fichiers de cette couche à importer
 * `electron`, avec `netFetch.ts`.
 */

import { net } from "electron";
import type { TransferNet } from "./core/transferNet";

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
