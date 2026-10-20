/**
 * Les préparations en cours et prêtes, et leur dossier (`data/offline-prepare/`).
 *
 * En MÉMOIRE : un redémarrage du serveur les oublie, et le dossier est vidé au
 * premier usage — une préparation interrompue ne se reprend pas (Jellyfin ne
 * sait pas reprendre un transcodage au milieu), et une relancée repart de zéro.
 * Le téléphone le constate tout seul : sa reprise par plage est refusée
 * (`servedFrom`), il repart du début, et la nouvelle préparation avance déjà.
 *
 * Effacement : sur demande du téléphone (`release`, une fois le titre chez lui
 * ou annulé), sinon par le balayage (`prepareExpired`). Jamais sous un lecteur.
 */

import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PrepareJob } from "./prepareJob";
import { prepareExpired } from "./prepareRules";

export class PrepareRegistry {
  private readonly jobs = new Map<string, PrepareJob>();
  private ready = false;

  constructor(
    private readonly dir: string,
    private readonly now: () => number,
  ) {}

  /** Le dossier, vidé de ce qu'un serveur précédent y a laissé. */
  private ensureDir(): void {
    if (this.ready) return;
    this.ready = true;
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
  }

  find(key: string): PrepareJob | null {
    return this.jobs.get(key) ?? null;
  }

  /**
   * La préparation de cette demande — l'existante, ou une neuve lancée par
   * `start`. Une préparation échouée ou relâchée est remplacée : la demander à
   * nouveau, c'est la relancer.
   */
  acquire(key: string, userId: string, itemId: string, start: (job: PrepareJob) => void): PrepareJob {
    const current = this.jobs.get(key);
    if (current !== undefined && current.state !== "failed" && !current.released) {
      current.lastAccessAt = this.now();
      return current;
    }
    if (current !== undefined) this.dispose(current);
    this.ensureDir();
    // Un nom par préparation : celle qui remplace une échouée n'écrit jamais
    // dans le fichier qu'un lecteur attardé tient encore ouvert.
    const base = join(this.dir, `${key}-${randomUUID().slice(0, 8)}.mp4`);
    const job = new PrepareJob(key, userId, itemId, `${base}.part`, base, this.now());
    this.jobs.set(key, job);
    start(job);
    return job;
  }

  /** Le téléphone n'en veut plus : arrêtée si elle tourne, effacée dès que plus personne ne lit. */
  release(key: string): boolean {
    const job = this.jobs.get(key);
    if (job === undefined) return false;
    job.released = true;
    if (job.state === "running") job.abort();
    this.settle(job);
    return true;
  }

  /** Un lecteur s'en va : ce qui attendait qu'il parte peut s'effacer. */
  settle(job: PrepareJob): void {
    if (prepareExpired(job, this.now())) this.dispose(job);
  }

  /** Le balayage périodique : ce qui a fait son temps s'efface. */
  sweep(): number {
    let removed = 0;
    for (const job of [...this.jobs.values()]) {
      if (!prepareExpired(job, this.now())) continue;
      this.dispose(job);
      removed += 1;
    }
    return removed;
  }

  private dispose(job: PrepareJob): void {
    if (job.readers > 0) return;
    if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
    if (job.state === "running") job.abort();
    rmSync(job.partPath, { force: true });
    rmSync(job.finalPath, { force: true });
  }

  /** Banc d'essai : tout ce qui est connu, dans l'ordre d'arrivée. */
  list(): PrepareJob[] {
    return [...this.jobs.values()];
  }
}
