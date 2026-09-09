/**
 * Le flux étranglé : ce qui s'intercale entre Jellyfin et le client.
 *
 * Un `Readable` TIRÉ, pas un `Transform` : l'amont n'est lu qu'à la demande de
 * l'aval, chaque chunk est découpé en blocs accordés par l'arbitre, et la
 * pompe s'arrête dès que l'aval est plein. Rien n'est lu qui ne puisse être
 * poussé — contre-pression exacte, accumulation bornée au `highWaterMark`, et
 * l'équité de l'arbitre mesure une consommation RÉELLE, pas des blocs qui
 * dorment dans un tampon. Sous plafond illimité, c'est un simple relais.
 *
 * La destruction — fin normale, erreur, client qui coupe — libère la part et
 * détruit l'amont : undici annule le fetch, Jellyfin voit la coupure, ffmpeg
 * s'arrête. Exactement ce que faisait `reply.send(Readable.fromWeb(...))`.
 */

import { Readable } from "node:stream";
import type { FastifyRequest } from "fastify";
import type { JellyfinUser } from "../../middleware/auth";
import { getDownloadInternalIps } from "../configStore";
import { getRealClientIp } from "../networkUtils";
import { MAX_BLOCK, type FlowHandle } from "./arbiter";
import { downloadArbiter } from "./instance";
import { poolFor } from "./pool";

export class ThrottledReadable extends Readable {
  private readonly source: AsyncIterator<Uint8Array>;
  private pending: Uint8Array | null = null;
  private pumping = false;
  /** L'aval a redemandé pendant que la pompe finissait : elle repart aussitôt. */
  private wanted = false;
  private ended = false;

  constructor(
    private readonly upstream: Readable,
    private readonly flow: FlowHandle,
  ) {
    super({ highWaterMark: MAX_BLOCK });
    this.source = upstream[Symbol.asyncIterator]() as AsyncIterator<Uint8Array>;
  }

  _read(): void {
    if (this.pumping) {
      this.wanted = true;
      return;
    }
    void this.pump();
  }

  private async pump(): Promise<void> {
    this.pumping = true;
    this.wanted = false;
    try {
      while (!this.destroyed && !this.ended) {
        if (this.pending === null) {
          const { value, done } = await this.source.next();
          if (done) {
            this.ended = true;
            this.push(null);
            return;
          }
          this.pending = value;
        }
        let granted = this.flow.take(this.pending.length);
        while (granted === 0) {
          await this.flow.next(); // ≤ un tick ; rejette si le flux est libéré
          granted = this.flow.take(this.pending.length);
        }
        const block = this.pending.subarray(0, granted); // une vue, pas une copie
        this.pending = granted < this.pending.length ? this.pending.subarray(granted) : null;
        if (!this.push(block)) return; // aval plein : `_read` relancera la pompe
      }
    } catch (error) {
      if (!this.destroyed) this.destroy(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.pumping = false;
      if (this.wanted && !this.destroyed && !this.ended) void this.pump();
    }
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.flow.release(); // la part revient aux autres à l'instant
    this.upstream.destroy();
    callback(error);
  }
}

/**
 * Le flux d'un téléchargement, sous le plafond de son pool. Le pool suit la
 * règle de la lecture directe — IP privée = réseau local — plus les adresses
 * que l'admin a déclarées locales (`poolFor`). Le compte est celui que
 * `requireAuth` a posé — un même compte partage sa part entre ses appareils.
 */
export function throttled(request: FastifyRequest, upstream: Readable): Readable {
  const user = (request as FastifyRequest & { user?: JellyfinUser }).user;
  const pool = poolFor(getRealClientIp(request), getDownloadInternalIps());
  return new ThrottledReadable(upstream, downloadArbiter.register(user?.userId ?? "anonymous", pool));
}
