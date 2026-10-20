/**
 * Le serveur prépare : il tire le transcodage de Jellyfin et l'écrit sur SON
 * disque, octet après octet, sans attendre personne. Les lecteurs
 * (`prepareTail.ts`) suivent le fichier qui grandit ; chaque écriture leur est
 * annoncée.
 *
 * Une écriture n'est comptée qu'une fois faite : un lecteur réveillé lit des
 * octets qui sont bien sur le disque.
 */

import { createWriteStream, renameSync, rmSync, type WriteStream } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import type { PrepareJob } from "./prepareJob";

/** Ouvre le flux de Jellyfin ; `signal` le coupe (téléphone qui annule, balayage). */
export type OpenUpstream = (signal: AbortSignal) => Promise<Response>;

function write(out: WriteStream, chunk: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    out.write(chunk, (error) => (error ? reject(error) : resolve()));
  });
}

function close(out: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    out.end((error?: Error | null) => (error ? reject(error) : resolve()));
  });
}

/**
 * Mène la préparation à son terme. Ne lève jamais : la fin est un état de la
 * préparation (`done` ou `failed`), annoncé à ses lecteurs.
 */
export async function runPreparation(
  job: PrepareJob,
  open: OpenUpstream,
  now: () => number,
  onDone: (job: PrepareJob) => void,
): Promise<void> {
  const controller = new AbortController();
  job.abort = () => controller.abort();
  let out: WriteStream | null = null;
  try {
    const upstream = await open(controller.signal);
    if (upstream.status !== 200 || !upstream.body) throw new Error(`jellyfin ${upstream.status}`);
    out = createWriteStream(job.partPath, { flags: "w" });
    const body = Readable.fromWeb(upstream.body as unknown as WebReadableStream<Uint8Array>);
    for await (const chunk of body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      await write(out, buffer);
      job.bytes += buffer.length;
      job.notify();
    }
    await close(out);
    out = null;
    if (job.bytes === 0) throw new Error("préparation vide");
    renameSync(job.partPath, job.finalPath);
    job.state = "done";
    job.doneAt = now();
    console.log(`[offline-prepare] prête : ${job.itemId} (${job.bytes} octets)`);
    job.notify();
    onDone(job);
  } catch (error) {
    out?.destroy();
    job.state = "failed";
    if (!job.released) console.warn(`[offline-prepare] échec : ${job.itemId} — ${String(error)}`);
    rmSync(job.partPath, { force: true });
    job.notify();
  }
}
