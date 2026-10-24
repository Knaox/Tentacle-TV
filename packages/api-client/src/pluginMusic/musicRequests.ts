/**
 * Points 2 et 3 — les appels à l'extension, sans React : la SOURCE de lecture
 * (`resolve`, jouable pendant l'écriture), l'ANTICIPATION (`prefetch`, jamais
 * bloquante, jamais une erreur pour l'appelant) et les GESTES (`like`,
 * `playlistAdd` : réponse immédiate, la résolution arrive par `music:resolved`).
 * Le lecteur et l'interface les appellent ; les crochets les enveloppent.
 */

import type {
  ExternalActionOutcome,
  MusicAlbum,
  MusicArtist,
  ExternalSourcesResponse,
  PendingMusicResponse,
  PlaybackSource,
  PrefetchIntent,
} from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { musicRouteUrl, type MusicProvider } from "./musicProvider";

const post = (body: unknown, signal?: AbortSignal): RequestInit => ({ method: "POST", body: JSON.stringify(body), signal });

/** Les sources des identifiants demandés ; un identifiant sans source n'a pas d'entrée (le client passe au suivant). */
export async function resolveMusicSources(provider: MusicProvider, ids: readonly string[], signal?: AbortSignal): Promise<Map<string, PlaybackSource>> {
  const out = new Map<string, PlaybackSource>();
  if (ids.length === 0) return out;
  const raw = await tentacleApiFetch<ExternalSourcesResponse>(musicRouteUrl(provider, provider.music.resolve), post({ ids }, signal));
  for (const entry of Array.isArray(raw?.sources) ? raw.sources : []) {
    if (entry && typeof entry.externalId === "string" && entry.source && typeof entry.source.url === "string") out.set(entry.externalId, entry.source);
  }
  return out;
}

/** Une source qui a expiré (`expiresAt` passé) se redemande. */
export function isSourceFresh(source: PlaybackSource, now = Date.now()): boolean {
  return source.expiresAt === null || source.expiresAt > now + 5_000;
}

/**
 * Le silence après un signal, par intention. Un survol se redit au bout de
 * 5 s : l'extension l'oublie après 8 s (sa politique d'anticipation), un
 * second survol plus tard doit donc arriver. `press` passe toujours.
 */
const PREFETCH_DEDUP_MS: Record<PrefetchIntent, number> = { results: 30_000, hover: 5_000, press: 0, next: 30_000 };
const recentPrefetch = new Map<string, number>();

/**
 * L'anticipation : au plus une fois par (titre, intention) dans le silence de
 * son intention ; `press` passe toujours (le clic arrive). Silencieuse : un
 * échec ne remonte jamais.
 */
export function prefetchMusic(provider: MusicProvider, ids: readonly string[], intent: PrefetchIntent, now = Date.now()): void {
  if (!provider.music.prefetch || ids.length === 0) return;
  const fresh = ids.filter((id) => {
    const key = `${provider.pluginId}:${intent}:${id}`;
    const last = recentPrefetch.get(key);
    if (last !== undefined && now - last < PREFETCH_DEDUP_MS[intent]) return false;
    recentPrefetch.set(key, now);
    return true;
  });
  if (recentPrefetch.size > 2_000) recentPrefetch.clear();
  if (fresh.length === 0) return;
  void tentacleApiFetch<unknown>(musicRouteUrl(provider, provider.music.prefetch), post({ ids: fresh.slice(0, 50), intent })).catch(() => undefined);
}

function readOutcome(raw: unknown): ExternalActionOutcome {
  const o = raw as Partial<ExternalActionOutcome> | null;
  if (o && o.ok === true && (o.state === "pending" || o.state === "library")) {
    return { ok: true, state: o.state, operationId: o.operationId ?? null, jellyfinId: o.jellyfinId ?? null };
  }
  const reason = o && o.ok === false ? o.reason : "failed";
  return { ok: false, reason: reason ?? "failed", message: o && o.ok === false ? o.message ?? null : null };
}

/** Un refus HTTP de l'extension rendu dans la liste fermée du contrat : le client a ses mots pour chacun. */
function refusalOf(err: unknown): ExternalActionOutcome {
  const status = (err as { status?: number } | null)?.status ?? 0;
  const reason = status === 403 ? "forbidden" : status === 404 ? "notFound" : status === 429 ? "quota" : status === 0 || status >= 500 ? "unavailable" : "failed";
  return { ok: false, reason, message: null };
}

export async function likeExternalTrack(provider: MusicProvider, externalId: string, liked: boolean): Promise<ExternalActionOutcome> {
  if (!provider.music.like) return { ok: false, reason: "unavailable", message: null };
  return tentacleApiFetch<unknown>(musicRouteUrl(provider, provider.music.like), post({ externalId, liked })).then(readOutcome, refusalOf);
}

export async function addExternalTrackToPlaylist(
  provider: MusicProvider,
  externalId: string,
  playlistId: string,
  position: number,
): Promise<ExternalActionOutcome> {
  if (!provider.music.playlistAdd) return { ok: false, reason: "unavailable", message: null };
  return tentacleApiFetch<unknown>(musicRouteUrl(provider, provider.music.playlistAdd), post({ externalId, playlistId, position })).then(readOutcome, refusalOf);
}

export async function fetchPendingMusic(provider: MusicProvider, signal?: AbortSignal): Promise<PendingMusicResponse> {
  if (!provider.music.pending) return { items: [] };
  const raw = await tentacleApiFetch<PendingMusicResponse>(musicRouteUrl(provider, provider.music.pending), { signal });
  return { items: Array.isArray(raw?.items) ? raw.items.filter((i) => !!i && typeof i.operationId === "string") : [] };
}

/** L'écoute menée au bout d'un titre hors bibliothèque (`music.played`) : silencieuse, jamais bloquante. */
export function reportExternalPlayed(provider: MusicProvider, externalId: string, completed: boolean): void {
  if (!provider.music.played) return;
  void tentacleApiFetch<unknown>(musicRouteUrl(provider, provider.music.played), post({ externalId, completed })).catch(() => undefined);
}

/** La vue d'un album hors bibliothèque (`music.album`), `null` si l'extension n'en sert pas. */
export function fetchExternalAlbum(provider: MusicProvider, albumId: string, signal?: AbortSignal): Promise<MusicAlbum | null> {
  if (!provider.music.album) return Promise.resolve(null);
  return tentacleApiFetch<MusicAlbum>(`${musicRouteUrl(provider, provider.music.album)}/${encodeURIComponent(albumId)}`, { signal });
}

/** La vue d'un artiste hors bibliothèque (`music.artist`), `null` si l'extension n'en sert pas. */
export function fetchExternalArtist(provider: MusicProvider, artistId: string, signal?: AbortSignal): Promise<MusicArtist | null> {
  if (!provider.music.artist) return Promise.resolve(null);
  return tentacleApiFetch<MusicArtist>(`${musicRouteUrl(provider, provider.music.artist)}/${encodeURIComponent(artistId)}`, { signal });
}

/** Pour les tests. */
export function resetMusicPrefetchForTests(): void {
  recentPrefetch.clear();
}
