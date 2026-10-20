/**
 * Lire une préparation PENDANT qu'elle s'écrit : on sert ce qui est déjà sur
 * le disque, on attend la suite, et on s'arrête quand elle est complète.
 *
 * Pour le téléphone, c'est un seul transfert continu, du premier au dernier
 * octet — confié tel quel à la session d'arrière-plan d'iOS ou au service
 * d'Android, il n'a besoin de personne pour avancer. Coupé, il reprend par
 * plage d'octets là où il en était (`servedFrom`), et la préparation, elle,
 * n'a jamais cessé d'avancer.
 *
 * Une préparation qui échoue coupe la réponse NET (erreur de flux) : le
 * téléphone y voit une coupure, jamais un fichier tronqué qu'on dirait
 * complet.
 */

import { open, type FileHandle } from "node:fs/promises";
import { Readable } from "node:stream";
import type { PrepareJob } from "./prepareJob";

/** Au plus par lecture : assez pour le débit, assez peu pour la mémoire. */
const READ_CHUNK = 256 * 1024;

export class PreparedTail extends Readable {
  private handle: FileHandle | null = null;
  private position: number;
  private reading = false;
  private waiting: (() => void) | null = null;
  private finished = false;

  constructor(
    private readonly job: PrepareJob,
    start: number,
    private readonly onClose: (job: PrepareJob) => void,
  ) {
    super();
    this.position = start;
    job.readers += 1;
  }

  override _read(): void {
    void this.pump();
  }

  private async openHandle(): Promise<FileHandle> {
    if (this.handle !== null) return this.handle;
    try {
      this.handle = await open(this.job.path, "r");
    } catch {
      // Renommée entre la lecture du chemin et l'ouverture : l'autre nom.
      this.handle = await open(this.job.path, "r");
    }
    return this.handle;
  }

  private async pump(): Promise<void> {
    if (this.reading || this.finished) return;
    this.reading = true;
    try {
      for (;;) {
        const available = this.job.bytes - this.position;
        if (available > 0) {
          const handle = await this.openHandle();
          const buffer = Buffer.allocUnsafe(Math.min(available, READ_CHUNK));
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, this.position);
          if (bytesRead === 0) break;
          this.position += bytesRead;
          if (!this.push(bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead))) break;
          continue;
        }
        if (this.job.state === "done") {
          this.push(null);
          break;
        }
        if (this.job.state === "failed") {
          this.destroy(new Error("préparation échouée"));
          break;
        }
        // Rien de neuf : on attend la prochaine écriture (ou la fin).
        this.waiting = this.job.onChange(() => {
          this.waiting?.();
          this.waiting = null;
          void this.pump();
        });
        break;
      }
    } catch (error) {
      this.destroy(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.reading = false;
    }
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.finished = true;
    this.waiting?.();
    this.waiting = null;
    this.job.readers -= 1;
    const handle = this.handle;
    this.handle = null;
    const finish = (): void => {
      this.onClose(this.job);
      callback(error);
    };
    if (handle === null) finish();
    else void handle.close().finally(finish);
  }
}
