import { JELLYFIN_AUTH_HEADER, JELLYFIN_TOKEN_HEADER } from "@tentacle-tv/shared";
import type { DeviceProfile, PlaybackInfoResponse } from "@tentacle-tv/shared";
import { DirectStreamingState, JellyfinError, buildQuery } from "./types";

/**
 * `POST /Items/{id}/PlaybackInfo` — c'est le serveur qui choisit le flux.
 *
 * Extraction mécanique de `JellyfinClient` (limite 300 lignes/fichier), sur le
 * modèle de `urlBuilder.ts` et `fetchWithRetry.ts` : la classe garde l'état, le
 * module garde la requête.
 */

export interface PlaybackInfoOptions {
  userId: string;
  deviceProfile: DeviceProfile;
  mediaSourceId?: string;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  startTimeTicks?: number;
  maxStreamingBitrate?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface PlaybackInfoDeps {
  /** Session de streaming direct, ou `null` quand tout passe par le proxy. */
  directStreaming: DirectStreamingState | null;
  getAuthHeader: (token?: string) => string;
  /** Le serveur média est injoignable en direct depuis cette origine. */
  signalerDirectBloque: (raison: string) => void;
  /** Repli : la même requête, par le proxy Tentacle (même origine). */
  viaProxy: (path: string, init: RequestInit) => Promise<PlaybackInfoResponse>;
}

export async function fetchPlaybackInfo(
  deps: PlaybackInfoDeps,
  itemId: string,
  options: PlaybackInfoOptions,
): Promise<PlaybackInfoResponse> {
  const q: Record<string, string> = {
    UserId: options.userId,
    StartTimeTicks: String(options.startTimeTicks ?? 0),
    IsPlayback: "true",
    AutoOpenLiveStream: "true",
  };
  // Aucun plafond par défaut : sans valeur explicite, c'est le
  // `MaxStreamingBitrate` du DeviceProfile qui fait foi (150 Mb/s sur le
  // navigateur, 120 sur mobile et TV, 400 sous mpv). Le défaut de 42 Mb/s
  // qui régnait ici s'appliquait à toute lecture en qualité « Originale » et
  // transcodait le moindre remux Blu-ray 4K — codecs parfaitement
  // compatibles — sur le seul critère du débit.
  if (options.maxStreamingBitrate) {
    q.MaxStreamingBitrate = String(options.maxStreamingBitrate);
  }
  if (options.mediaSourceId) q.MediaSourceId = options.mediaSourceId;
  if (options.audioStreamIndex != null) q.AudioStreamIndex = String(options.audioStreamIndex);
  if (options.subtitleStreamIndex != null) q.SubtitleStreamIndex = String(options.subtitleStreamIndex);
  if (options.maxWidth) q.MaxWidth = String(options.maxWidth);
  if (options.maxHeight) q.MaxHeight = String(options.maxHeight);

  const path = `/Items/${itemId}/PlaybackInfo?${buildQuery(q)}`;
  const body = JSON.stringify({ DeviceProfile: options.deviceProfile });

  // Direct streaming: call Jellyfin directly so the transcode session
  // (and all HLS segment URLs) use the user's token, not the admin API key.
  if (deps.directStreaming) {
    try {
      const { mediaBaseUrl, jellyfinToken } = deps.directStreaming;
      const res = await fetch(`${mediaBaseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [JELLYFIN_AUTH_HEADER]: deps.getAuthHeader(jellyfinToken),
          [JELLYFIN_TOKEN_HEADER]: jellyfinToken,
        },
        body,
      });
      if (!res.ok) throw new JellyfinError(res.status, res.statusText, path);
      const text = res.status === 204 ? "" : await res.text();
      return text ? JSON.parse(text) : (undefined as unknown as PlaybackInfoResponse);
    } catch (e) {
      // Une `JellyfinError` est une réponse du serveur : il a répondu, le
      // direct fonctionne, c'est la requête qui a été refusée. On la propage.
      if (e instanceof JellyfinError) throw e;
      // Le reste est un échec RÉSEAU : préflight CORS refusé, serveur média
      // injoignable depuis cette origine. Ce n'est pas propre au PlaybackInfo —
      // le manifeste HLS et les segments partiront au même mur. On coupe donc
      // le direct tout de suite, pour que l'URL de stream construite juste
      // après parte déjà sur le proxy : un seul chargement au lieu de deux.
      deps.signalerDirectBloque(`PlaybackInfo direct refuse (${(e as Error)?.message ?? e})`);
    }
  }

  return deps.viaProxy(path, { method: "POST", body });
}
