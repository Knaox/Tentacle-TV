/**
 * Octave — les appels aux routes d'une extension musique, sous
 * `/api/plugins/<id>` (relayées par le cœur après requireAuth). Formes :
 * pluginMusicContract.ts. ADAPTATEUR provisoire (agent 5 livre la porte
 * officielle dans l'api-client) — l'interface n'appelle une extension que par ici.
 */

import { tentacleApiFetch } from "@tentacle-tv/api-client";
import type {
  ExternalActionOutcome,
  ExternalMusicSearchPage,
  ExternalSourcesResponse,
  MusicAlbum,
  MusicArtist,
  PendingMusicResponse,
  PrefetchIntent,
} from "@tentacle-tv/shared/music";
import { fetchVoid } from "../data/libraryApi";
import type { MusicProvider } from "./musicProviders";

function pluginPath(provider: MusicProvider, route: string): string {
  return `/api/plugins/${encodeURIComponent(provider.pluginId)}${route}`;
}

function post(body: unknown): RequestInit {
  return { method: "POST", body: JSON.stringify(body) };
}

export const externalApi = {
  search(provider: MusicProvider, q: string, cursor: string | null, signal?: AbortSignal): Promise<ExternalMusicSearchPage> {
    const params = new URLSearchParams({ q, limit: "20" });
    if (cursor) params.set("cursor", cursor);
    return tentacleApiFetch<ExternalMusicSearchPage>(`${pluginPath(provider, provider.manifest.search)}?${params}`, { signal });
  },

  resolve(provider: MusicProvider, ids: string[]): Promise<ExternalSourcesResponse> {
    return tentacleApiFetch<ExternalSourcesResponse>(pluginPath(provider, provider.manifest.resolve), post({ ids }));
  },

  /** Jamais bloquant, jamais une erreur visible : l'anticipation est un conseil. */
  prefetch(provider: MusicProvider, ids: string[], intent: PrefetchIntent): void {
    const route = provider.manifest.prefetch;
    if (!route || ids.length === 0) return;
    void fetchVoid(pluginPath(provider, route), post({ ids, intent })).catch(() => undefined);
  },

  like(provider: MusicProvider, externalId: string, liked: boolean): Promise<ExternalActionOutcome> {
    const route = provider.manifest.like;
    if (!route) return Promise.resolve({ ok: false, reason: "unavailable", message: null });
    return tentacleApiFetch<ExternalActionOutcome>(pluginPath(provider, route), post({ externalId, liked }));
  },

  playlistAdd(provider: MusicProvider, externalId: string, playlistId: string, position: number): Promise<ExternalActionOutcome> {
    const route = provider.manifest.playlistAdd;
    if (!route) return Promise.resolve({ ok: false, reason: "unavailable", message: null });
    return tentacleApiFetch<ExternalActionOutcome>(pluginPath(provider, route), post({ externalId, playlistId, position }));
  },

  pending(provider: MusicProvider): Promise<PendingMusicResponse> {
    const route = provider.manifest.pending;
    if (!route) return Promise.resolve({ items: [] });
    return tentacleApiFetch<PendingMusicResponse>(pluginPath(provider, route));
  },

  played(provider: MusicProvider, externalId: string, completed: boolean): void {
    const route = provider.manifest.played;
    if (!route) return;
    void fetchVoid(pluginPath(provider, route), post({ externalId, completed })).catch(() => undefined);
  },

  album(provider: MusicProvider, albumId: string): Promise<MusicAlbum> | null {
    const route = provider.manifest.album;
    return route ? tentacleApiFetch<MusicAlbum>(`${pluginPath(provider, route)}/${encodeURIComponent(albumId)}`) : null;
  },

  artist(provider: MusicProvider, artistId: string): Promise<MusicArtist> | null {
    const route = provider.manifest.artist;
    return route ? tentacleApiFetch<MusicArtist>(`${pluginPath(provider, route)}/${encodeURIComponent(artistId)}`) : null;
  },
};

export type ExternalApi = typeof externalApi;
