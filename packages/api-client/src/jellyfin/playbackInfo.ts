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
  signalDirectBlocked: (reason: string) => void;
  /** Repli : la même requête, par le proxy Tentacle (même origine). */
  viaProxy: (path: string, init: RequestInit) => Promise<PlaybackInfoResponse>;
  /**
   * La même requête, postée par la couche NATIVE — hors du moteur web, donc
   * hors CORS. Injectée par l'hôte quand il en a une (coquille Electron, dont
   * l'origine applicative n'obtiendra jamais de CORS d'un Jellyfin
   * quelconque). Ce module ne connaît aucune plateforme : il prend la voie
   * qu'on lui donne, comme `nativeSessionPost`.
   */
  nativePlaybackInfo?: (
    baseUrl: string,
    itemId: string,
    query: string,
    token: string,
    authHeader: string,
    body: string,
  ) => Promise<{ status: number; body: string }>;
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
    // La voie NATIVE d'abord, quand l'hôte en a une : sur la coquille, le
    // `fetch` de la page est voué au mur CORS — le tenter coûterait un
    // préflight perdu ET couperait le direct pour toute la session (URLs
    // médias du lecteur natif comprises, via `signalDirectBlocked`).
    if (deps.nativePlaybackInfo) {
      const { mediaBaseUrl, jellyfinToken } = deps.directStreaming;
      try {
        const res = await deps.nativePlaybackInfo(
          mediaBaseUrl,
          itemId,
          buildQuery(q),
          jellyfinToken,
          deps.getAuthHeader(jellyfinToken),
          body,
        );
        // Une réponse du serveur, même un refus : le direct fonctionne, on la
        // traite comme telle — seule la panne de TRANSPORT coupe le direct.
        if (res.status < 200 || res.status >= 300) {
          throw new JellyfinError(res.status, `HTTP ${res.status}`, path);
        }
        return res.body ? JSON.parse(res.body) : (undefined as unknown as PlaybackInfoResponse);
      } catch (e) {
        if (e instanceof JellyfinError) throw e;
        // Le serveur média est injoignable DEPUIS LA MACHINE (le natif n'a pas
        // de CORS) : manifeste et segments partiraient au même mur.
        deps.signalDirectBlocked(`PlaybackInfo natif refuse (${(e as Error)?.message ?? e})`);
        return deps.viaProxy(path, { method: "POST", body });
      }
    }
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
      deps.signalDirectBlocked(`PlaybackInfo direct refuse (${(e as Error)?.message ?? e})`);
    }
  }

  return deps.viaProxy(path, { method: "POST", body });
}
