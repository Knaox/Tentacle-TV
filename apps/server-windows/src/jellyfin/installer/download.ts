/**
 * Le téléchargement de l'installateur : en flux vers `<fichier>.part`,
 * empreinte SHA-256 calculée au fil de l'eau, taille bornée — celle de la page
 * miroir quand elle est connue, sinon un plafond. Le fichier ne prend son nom
 * qu'APRÈS la vérification : un `.exe` présent est toujours un `.exe` vérifié.
 * Tout écart efface le fichier.
 */
import { createHash } from "node:crypto";
import { createWriteStream, renameSync, rmSync } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

/** Au-delà, ce n'est plus un installateur de Jellyfin (~200 Mo aujourd'hui). */
export const DOWNLOAD_CEILING_BYTES = 1024 * 1024 * 1024;

export interface DownloadExpectation {
  sha256: string;
  size: number | null;
}

export type DownloadOutcome = { ok: true } | { ok: false; failure: "network" | "checksum" };

export type BodyFetcher = (url: string, signal: AbortSignal) => Promise<{ status: number; body: Readable | null }>;

/** La lecture réelle : la redirection vers le miroir est suivie (l'empreinte, elle, vient de l'origine). */
export const fetchBody: BodyFetcher = async (url, signal) => {
  const response = await fetch(url, { redirect: "follow", signal });
  const body = response.body ? Readable.fromWeb(response.body as WebReadableStream<Uint8Array>) : null;
  return { status: response.status, body };
};

class TooBig extends Error {}

export async function downloadVerified(
  fetcher: BodyFetcher,
  url: string,
  destination: string,
  expected: DownloadExpectation,
  onProgress: (received: number) => void,
  signal: AbortSignal,
): Promise<DownloadOutcome> {
  const partial = `${destination}.part`;
  const limit = expected.size ?? DOWNLOAD_CEILING_BYTES;
  let reply: { status: number; body: Readable | null };
  try {
    reply = await fetcher(url, signal);
  } catch {
    return { ok: false, failure: "network" };
  }
  if (reply.status !== 200 || reply.body === null) {
    reply.body?.destroy();
    return { ok: false, failure: "network" };
  }
  const hash = createHash("sha256");
  let received = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      received += chunk.length;
      if (received > limit) {
        done(new TooBig());
        return;
      }
      hash.update(chunk);
      onProgress(received);
      done(null, chunk);
    },
  });
  try {
    // `pipeline` ferme tout en cas d'erreur : le `.part` n'est plus tenu quand on l'efface.
    await pipeline(reply.body, meter, createWriteStream(partial));
  } catch (error) {
    rmSync(partial, { force: true });
    return { ok: false, failure: error instanceof TooBig ? "checksum" : "network" };
  }
  if ((expected.size !== null && received !== expected.size) || hash.digest("hex") !== expected.sha256) {
    rmSync(partial, { force: true });
    return { ok: false, failure: "checksum" };
  }
  renameSync(partial, destination);
  return { ok: true };
}
