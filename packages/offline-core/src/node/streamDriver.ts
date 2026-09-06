/**
 * Le pilote de transfert du bureau : un flux HTTP lu bloc par bloc et écrit
 * dans le `.part` à mesure.
 *
 * C'est l'ancienne boucle de `transfer.ts`, séparée de la politique (reprise,
 * intégrité, classification) qui, elle, ne dépend plus de Node. Le réseau
 * entre par `TransferNet` (Electron `net.fetch` en production, un flux simulé
 * dans les tests) et le disque par `PartWriter`.
 */

import type { FileStore, TransferDriver, TransferOutcome, TransferRequest } from "../core/adapters";
import type { TransferNet } from "../core/transferNet";
import type { PartHandle, PartWriter } from "./nodePartWriter";

export function createStreamDriver(
  net: TransferNet,
  writer: PartWriter,
  files: FileStore,
): TransferDriver {
  return {
    download: (request) => download(net, writer, files, request),
    stopTranscode: (url, headers) => net.killTranscode(url, headers),
  };
}

async function download(
  net: TransferNet,
  writer: PartWriter,
  files: FileStore,
  request: TransferRequest,
): Promise<TransferOutcome> {
  const abort = new AbortController();
  const headers: Record<string, string> = { ...request.headers };
  if (request.resumeFrom > 0) headers["Range"] = `bytes=${request.resumeFrom}-`;

  let stream;
  try {
    stream = await net.open(request.url, headers, abort.signal);
  } catch {
    return { kind: "failed", cause: "network", bytesKnown: request.resumeFrom };
  }
  request.onHeaders?.(stream.status, stream.header);
  // Une erreur HTTP : rien n'est écrit, la politique décide du code.
  if (stream.status >= 400) return { kind: "done", status: stream.status, header: stream.header };

  // 200 alors qu'on demandait une reprise : le serveur a ignoré la plage. On
  // repart de zéro proprement plutôt que d'écrire à côté.
  let total = request.resumeFrom;
  let mode: "truncate" | "reuse" = total > 0 ? "reuse" : "truncate";
  if (stream.status === 200 && total > 0) {
    total = 0;
    mode = "truncate";
  }

  const fh = await writer.open(request.partPath, mode).catch(() => null);
  if (fh === null) return { kind: "failed", cause: "io", bytesKnown: total };

  const discard = (): void => {
    try {
      files.remove(request.partPath);
    } catch {
      // Un `.part` qui reste sera jeté au prochain passage.
    }
  };
  const closeQuietly = async (handle: PartHandle): Promise<void> => {
    await handle.sync().catch(() => undefined);
    await handle.close().catch(() => undefined);
  };
  // Un flux figé (serveur muet) ne rend plus la main au prochain bloc : la
  // bascule doit pouvoir couper la lecture elle-même.
  const unsubscribe = request.signal.subscribe(() => {
    if (request.signal.cancel || request.signal.pause) abort.abort();
  });

  try {
    for await (const chunk of stream.chunks) {
      if (request.signal.cancel) {
        abort.abort();
        await closeQuietly(fh);
        discard();
        return { kind: "canceled" };
      }
      if (request.signal.pause) {
        abort.abort();
        await closeQuietly(fh);
        return { kind: "paused", bytesKnown: total };
      }
      try {
        await fh.write(chunk, total);
      } catch (error) {
        await closeQuietly(fh);
        const cause = files.classify(error) === "disk-full" ? "disk-full" : "io";
        return { kind: "failed", cause, bytesKnown: total };
      }
      total += chunk.byteLength;
      request.onBytes(total);
    }
  } catch {
    await closeQuietly(fh);
    // La lecture a été coupée par NOTRE bascule, ou par le réseau.
    if (request.signal.cancel) {
      discard();
      return { kind: "canceled" };
    }
    if (request.signal.pause) return { kind: "paused", bytesKnown: total };
    // Flux coupé en cours de route : la politique en fait une pause SYSTÈME.
    return { kind: "failed", cause: "network", bytesKnown: total };
  } finally {
    unsubscribe();
  }

  try {
    await fh.sync();
  } catch {
    await fh.close().catch(() => undefined);
    return { kind: "failed", cause: "io", bytesKnown: total };
  }
  await fh.close();
  return { kind: "done", status: stream.status, header: stream.header };
}
