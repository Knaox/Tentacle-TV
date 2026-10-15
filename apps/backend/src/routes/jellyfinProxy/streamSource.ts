import { jellyfinAdminFetch } from "../../services/jellyfinAdminFetch";
import type { ConversionSource } from "../../playback/playbackRights";

/**
 * Les pistes d'une source, pour juger ce qu'un flux convertit
 * (`streamConversions`) — lues SEULEMENT pour un compte à qui une conversion
 * est refusée : un compte sans restriction ne coûte aucune requête. Au nom du
 * compte (`userId`, clé d'administration), gardées dix minutes : les segments
 * HLS d'une même lecture n'en coûtent qu'une. Illisibles : `null`, et seules
 * les demandes explicites de la requête sont jugées.
 */

const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 200;

interface JellyfinMediaSource extends ConversionSource {
  Id?: string;
}

const cache = new Map<string, { source: ConversionSource | null; expiresAt: number }>();

const normalize = (id: string) => id.replace(/-/g, "").toLowerCase();

/** La source nommée par `MediaSourceId`, sinon la première. Règle pure. */
export function pickSource(sources: readonly JellyfinMediaSource[], mediaSourceId: string | null): ConversionSource | null {
  const chosen = (mediaSourceId && sources.find((source) => source.Id && normalize(source.Id) === normalize(mediaSourceId))) || sources[0];
  return chosen ? { MediaStreams: chosen.MediaStreams ?? [], DefaultAudioStreamIndex: chosen.DefaultAudioStreamIndex ?? null } : null;
}

export async function streamSourceFacts(itemId: string, mediaSourceId: string | null, userId: string): Promise<ConversionSource | null> {
  const key = `${normalize(itemId)}:${mediaSourceId ? normalize(mediaSourceId) : ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.source;
  const result = await jellyfinAdminFetch<{ MediaSources?: JellyfinMediaSource[] }>(
    `/Items/${encodeURIComponent(itemId)}?userId=${encodeURIComponent(userId)}&Fields=MediaSources`,
  );
  const source = result.ok && Array.isArray(result.data?.MediaSources) ? pickSource(result.data.MediaSources, mediaSourceId) : null;
  cache.set(key, { source, expiresAt: Date.now() + (source ? TTL_MS : 5_000) });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return source;
}
