/**
 * Octave — ce que le cœur lit de Jellyfin pour la musique, et comment.
 *
 * Toujours la clé d'administration (`jellyfinAdminFetch`, la forme d'en-tête
 * que Jellyfin 10.11 et 12 acceptent), et `userId` quand Jellyfin doit juger
 * POUR un compte (droits, favoris, playlists) : relevé du banc du 2026-10-24,
 * la clé + `userId` agit au nom du compte pour l'ajout à une playlist et le
 * favori, et Jellyfin y applique ses refus (403 hors propriétaire).
 */

import { fetch as undiciFetch, type Response as UndiciResponse } from "undici";
import { getJellyfinApiKey, getJellyfinUrl } from "../../services/configStore";
import { jellyfinAdminFetch, type JellyfinResult } from "../../services/jellyfinAdminFetch";
import { jellyfinAuthHeaders } from "../../services/jellyfinAuth";
import { getJellyfinDispatcher } from "../../services/jellyfinHttpAgent";

export interface JfNamedRef {
  Id?: string;
  Name?: string;
}

export interface JfMediaStream {
  Type?: string;
  Codec?: string;
  SampleRate?: number;
  BitDepth?: number;
  BitRate?: number;
  Channels?: number;
}

export interface JfMediaSource {
  Container?: string;
  Size?: number;
  Bitrate?: number;
  MediaStreams?: JfMediaStream[];
}

/** Le sous-ensemble de `BaseItemDto` que la musique lit. */
export interface JfItem {
  Id: string;
  Type?: string;
  Name?: string;
  SortName?: string;
  Album?: string;
  AlbumId?: string;
  AlbumArtist?: string;
  AlbumArtists?: JfNamedRef[];
  ArtistItems?: JfNamedRef[];
  ProductionYear?: number;
  PremiereDate?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  RunTimeTicks?: number;
  ChildCount?: number;
  ProviderIds?: Record<string, string | undefined>;
  MediaSources?: JfMediaSource[];
  ImageTags?: Record<string, string | undefined>;
  AlbumPrimaryImageTag?: string;
  DateCreated?: string;
  NormalizationGain?: number;
  Studios?: JfNamedRef[];
  Path?: string;
  CanDelete?: boolean;
  MediaType?: string;
  PlaylistItemId?: string;
  UserData?: { IsFavorite?: boolean; PlayCount?: number; LastPlayedDate?: string };
}

export interface JfItemsPage {
  Items?: JfItem[];
  TotalRecordCount?: number;
}

/** Les champs que l'index garde ; rien de plus ne voyage. */
export const INDEX_FIELDS = "ProviderIds,SortName,DateCreated,MediaSources,ChildCount,Studios,PremiereDate,Path";

export type MusicItemType = "Audio" | "MusicAlbum" | "MusicArtist";

export function jfAdmin<T>(path: string, options: Parameters<typeof jellyfinAdminFetch>[1] = {}): Promise<JellyfinResult<T>> {
  return jellyfinAdminFetch<T>(path, { timeoutMs: 15_000, ...options });
}

/** Une écriture sans corps de réponse (204) : vrai si Jellyfin l'a acceptée. */
export async function jfWrite(path: string, method: "POST" | "DELETE", body?: unknown): Promise<{ ok: boolean; status?: number }> {
  const result = await jellyfinAdminFetch(path, { method, body, expectEmpty: true, timeoutMs: 15_000 });
  return result.ok ? { ok: true } : { ok: false, status: result.status };
}

/**
 * Une requête BRUTE (flux, image) à Jellyfin avec la clé d'administration, par
 * le pool keep-alive du proxy. Ne lève jamais : `null` si Jellyfin est muet.
 */
export async function jfRaw(
  path: string,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<UndiciResponse | null> {
  const base = getJellyfinUrl();
  const key = getJellyfinApiKey();
  if (!base || !key) return null;
  try {
    return await undiciFetch(`${base}${path}`, {
      headers: { ...jellyfinAuthHeaders(key), ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(30_000),
      dispatcher: getJellyfinDispatcher(),
    });
  } catch {
    return null;
  }
}

/** Sans tirets, en minuscules : Jellyfin rend les identifiants sous les deux formes. */
export function normalizeId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

/** Un identifiant Jellyfin plausible (il voyage dans des URL). */
export function isJellyfinId(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-fA-F-]{32,36}$/.test(id);
}

export function q(value: string): string {
  return encodeURIComponent(value);
}
