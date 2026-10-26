/**
 * Octave — les appels de l'IMPORT de playlists, sans React : le cœur
 * (`POST /api/music/import`, suivi `GET /api/music/import/:jobId`) et les
 * points optionnels de l'extension (`importRead`, `importTracks`), relayés par
 * le cœur sous `/api/plugins/<id>`. Un refus rend son code (liste fermée),
 * jamais un message brut.
 */

import {
  MUSIC_IMPORT_ROUTES,
  type ImportedPlaylist,
  type ImportReadRefusal,
  type ImportTracksAccepted,
  type ImportTracksProgress,
  type ImportTracksRequest,
  type MusicImportJob,
  type MusicImportRequest,
} from "@tentacle-tv/shared/music";
import { TentacleApiError, tentacleApiFetch } from "../../hooks/usePreferences";
import { musicRouteUrl, type MusicProvider } from "../../pluginMusic/musicProvider";

const post = (body: unknown, signal?: AbortSignal): RequestInit => ({ method: "POST", body: JSON.stringify(body), signal });

/** Le code `error` d'un refus (`{ error: "…" }`), ou `null`. */
export function refusalCode(error: unknown): string | null {
  if (!(error instanceof TentacleApiError)) return null;
  try {
    const body = JSON.parse(error.message) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

export async function startCoreImport(request: MusicImportRequest, signal?: AbortSignal): Promise<string> {
  const answer = await tentacleApiFetch<{ jobId?: unknown }>(MUSIC_IMPORT_ROUTES.start, post(request, signal));
  if (typeof answer.jobId !== "string") throw new Error("import: no job");
  return answer.jobId;
}

export function fetchCoreImport(jobId: string, signal?: AbortSignal): Promise<MusicImportJob> {
  return tentacleApiFetch<MusicImportJob>(MUSIC_IMPORT_ROUTES.job.replace(":jobId", encodeURIComponent(jobId)), { signal });
}

const READ_REFUSALS: readonly ImportReadRefusal[] = ["unsupported", "notFound", "private", "unavailable", "tooLarge", "budget"];

/** `importRead` : la playlist lue par l'extension, ou son refus (liste fermée). */
export async function readByExtension(provider: MusicProvider, url: string, signal?: AbortSignal): Promise<{ ok: true; playlist: ImportedPlaylist } | { ok: false; refusal: ImportReadRefusal }> {
  if (!provider.music.importRead) return { ok: false, refusal: "unsupported" };
  try {
    const playlist = await tentacleApiFetch<ImportedPlaylist>(musicRouteUrl(provider, provider.music.importRead), post({ url }, signal));
    return Array.isArray(playlist?.tracks) ? { ok: true, playlist } : { ok: false, refusal: "unavailable" };
  } catch (error) {
    if (signal?.aborted) throw error;
    const code = refusalCode(error);
    return { ok: false, refusal: READ_REFUSALS.find((r) => r === code) ?? "unavailable" };
  }
}

export async function confideImportTracks(provider: MusicProvider, request: ImportTracksRequest, signal?: AbortSignal): Promise<ImportTracksAccepted | null> {
  if (!provider.music.importTracks) return null;
  const accepted = await tentacleApiFetch<ImportTracksAccepted>(musicRouteUrl(provider, provider.music.importTracks), post(request, signal));
  return typeof accepted?.operationId === "string" ? accepted : null;
}

export function fetchImportTracksProgress(provider: MusicProvider, operationId: string, signal?: AbortSignal): Promise<ImportTracksProgress> {
  return tentacleApiFetch<ImportTracksProgress>(musicRouteUrl(provider, `${provider.music.importTracks}/${encodeURIComponent(operationId)}`), { signal });
}

export async function cancelImportTracks(provider: MusicProvider, operationId: string): Promise<void> {
  if (!provider.music.importTracks) return;
  // 204 sans corps : la lecture du JSON échoue, la réponse était bonne.
  await tentacleApiFetch<unknown>(musicRouteUrl(provider, `${provider.music.importTracks}/${encodeURIComponent(operationId)}`), { method: "DELETE" }).catch(() => undefined);
}
