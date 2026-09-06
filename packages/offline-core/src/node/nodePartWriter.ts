/**
 * Écritures POSITIONNELLES dans un `.part`, par `node:fs/promises`.
 *
 * Le pilote de flux écrit chaque bloc à son offset plutôt qu'en ajout : une
 * reprise rouvre le fichier sans le tronquer et continue exactement où le
 * transfert précédent s'était arrêté.
 */

import { open } from "node:fs/promises";

export interface PartHandle {
  write(chunk: Uint8Array, offset: number): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}

export interface PartWriter {
  /** `truncate` = repartir de zéro ; `reuse` = rouvrir pour une reprise. */
  open(target: string, mode: "truncate" | "reuse"): Promise<PartHandle>;
}

export const nodePartWriter: PartWriter = {
  async open(target, mode) {
    const fh = await open(target, mode === "truncate" ? "w" : "r+");
    return {
      async write(chunk, offset) {
        await fh.write(chunk, 0, chunk.byteLength, offset);
      },
      sync: () => fh.sync(),
      close: () => fh.close(),
    };
  },
};
