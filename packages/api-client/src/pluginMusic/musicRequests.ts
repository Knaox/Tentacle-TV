/**
 * Points 2 et 3 — les appels à l'extension, sans React : la SOURCE de lecture
 * (`resolve`, jouable pendant l'écriture), l'ANTICIPATION (`prefetch`, jamais
 * bloquante, jamais une erreur pour l'appelant) et les GESTES (`like`,
 * `playlistAdd` : réponse immédiate, la résolution arrive par `music:resolved`).
 * Le lecteur et l'interface les appellent ; les crochets les enveloppent.
 */

import type {
  ExternalActionOutcome,
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

const PREFETCH_DEDUP_MS = 30_000;
const recentPrefetch = new Map<string, number>();

/**
 * L'anticipation : au plus une fois par (titre, intention) toutes les 30 s ;
 * `press` passe toujours (le clic arrive). Silencieuse : un échec ne remonte jamais.
 */
export function prefetchMusic(provider: MusicProvider, ids: readonly string[], intent: PrefetchIntent, now = Date.now()): void {
  if (!provider.music.prefetch || ids.length === 0) return;
  const fresh = ids.filter((id) => {
    const key = `${provider.pluginId}:${intent}:${id}`;
    const last = recentPrefetch.get(key);
    if (intent !== "press" && last !== undefined && now - last < PREFETCH_DEDUP_MS) return false;
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

/** Pour les tests. */
export function resetMusicPrefetchForTests(): void {
  recentPrefetch.clear();
}
