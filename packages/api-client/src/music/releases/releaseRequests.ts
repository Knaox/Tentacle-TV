/**
 * Octave — les appels de l'IMPORT DE SORTIES (musicReleaseImport.ts), sans React : les routes de l'extension sous
 * son point `releases`, relayées par le cœur sous `/api/plugins/<id>`. Un refus rend son code (liste fermée),
 * jamais un message brut.
 */

import { readReleaseRefusal, type ReleaseFileAnnounce, type ReleaseImportJob, type ReleaseImportList, type ReleaseImportRefusal } from "@tentacle-tv/shared/music";
import { TentacleApiError, tentacleApiFetch } from "../../hooks/usePreferences";
import { musicRouteUrl, type MusicProvider } from "../../pluginMusic/musicProvider";
import { refusalCode } from "../import/importRequests";

/** Un refus du serveur : son code (liste fermée), et s'il vaut la peine de réessayer (réseau, 5xx, 429). */
export class ReleaseRequestError extends Error {
  constructor(
    readonly refusal: ReleaseImportRefusal,
    readonly transient: boolean,
  ) {
    super(refusal);
    this.name = "ReleaseRequestError";
  }
}

export function toReleaseError(error: unknown): ReleaseRequestError {
  if (error instanceof ReleaseRequestError) return error;
  if (error instanceof TentacleApiError) {
    const code = refusalCode(error);
    const transient = error.status === 0 || error.status === 429 || error.status >= 500;
    if (code) return new ReleaseRequestError(readReleaseRefusal(code), transient);
    if (error.status === 413) return new ReleaseRequestError("tooLarge", false);
    if (error.status === 404) return new ReleaseRequestError("notFound", false);
    if (error.status === 403) return new ReleaseRequestError("forbidden", false);
    return new ReleaseRequestError("failed", transient);
  }
  // `fetch` a échoué sans réponse : le réseau.
  return new ReleaseRequestError("failed", true);
}

function route(provider: MusicProvider, tail = ""): string {
  return musicRouteUrl(provider, `${provider.music.releases}${tail}`);
}

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw toReleaseError(error);
  }
}

const post = (body: unknown, signal?: AbortSignal): RequestInit => ({ method: "POST", body: JSON.stringify(body), signal });

export function startLinkImport(provider: MusicProvider, url: string, signal?: AbortSignal): Promise<ReleaseImportJob> {
  return call(() => tentacleApiFetch<ReleaseImportJob>(route(provider, "/link"), post({ url }, signal)));
}

export function startFilesImport(provider: MusicProvider, files: ReleaseFileAnnounce[], signal?: AbortSignal): Promise<ReleaseImportJob> {
  return call(() => tentacleApiFetch<ReleaseImportJob>(route(provider, "/files"), post({ files }, signal)));
}

/** Un morceau d'un fichier, à sa place ; rend les octets que le serveur tient désormais. */
export async function putReleaseChunk(provider: MusicProvider, uploadId: string, offset: number, body: BodyInit, signal?: AbortSignal): Promise<number> {
  const answer = await call(() =>
    tentacleApiFetch<{ received?: unknown }>(musicRouteUrl(provider, `${provider.music.releases}/files/${encodeURIComponent(uploadId)}`, { offset }), {
      method: "PUT",
      body,
      headers: { "Content-Type": "application/octet-stream" },
      signal,
    }),
  );
  return typeof answer.received === "number" ? answer.received : offset;
}

/** Ce que le serveur a déjà reçu d'un fichier (reprise après une coupure). */
export async function fetchReleaseUpload(provider: MusicProvider, uploadId: string, signal?: AbortSignal): Promise<number> {
  const answer = await call(() => tentacleApiFetch<{ received?: unknown }>(route(provider, `/files/${encodeURIComponent(uploadId)}`), { signal }));
  return typeof answer.received === "number" ? answer.received : 0;
}

export function fetchReleaseJob(provider: MusicProvider, jobId: string, signal?: AbortSignal): Promise<ReleaseImportJob> {
  return call(() => tentacleApiFetch<ReleaseImportJob>(route(provider, `/jobs/${encodeURIComponent(jobId)}`), { signal }));
}

export async function cancelReleaseJob(provider: MusicProvider, jobId: string): Promise<void> {
  // 204 sans corps : la lecture du JSON échoue, la réponse était bonne.
  await tentacleApiFetch<unknown>(route(provider, `/jobs/${encodeURIComponent(jobId)}`), { method: "DELETE" }).catch(() => undefined);
}

/** Les albums importés du compte ; une extension qui n'en tient pas la liste : aucun. */
export async function fetchImportedReleases(provider: MusicProvider, signal?: AbortSignal): Promise<ReleaseImportList> {
  const list = await tentacleApiFetch<ReleaseImportList>(route(provider), { signal });
  return { albums: Array.isArray(list?.albums) ? list.albums : [] };
}
