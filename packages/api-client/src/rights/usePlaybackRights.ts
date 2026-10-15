import { useQuery } from "@tanstack/react-query";
import { FULL_PLAYBACK_RIGHTS, type PlaybackRights } from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapabilities } from "../hooks/useServerCapabilities";
import { useUserId } from "../hooks/useUserId";

/**
 * Les droits de lecture du compte pour CET appareil (docs/DROITS-UTILISATEURS.md
 * § 9.2) : `GET /api/playback/rights`, derrière la capacité `playback.rights`.
 * Le serveur les applique de toute façon (proxy) ; les lecteurs s'en servent
 * pour ne jamais demander un mode refusé et dire pourquoi.
 *
 * Sans la capacité : tous les droits, comme avant. Une lecture qui échoue :
 * tous les droits aussi — le proxy garde, le lecteur dira son refus (403).
 * API commune react-query v4 / v5 (la TV tourne en v4).
 */
export const PLAYBACK_RIGHTS_KEY = "playback-rights";

export interface PlaybackRightsState {
  rights: PlaybackRights;
  /** Les droits sont CONNUS (ou réputés pleins) : un lecteur peut décider. */
  settled: boolean;
}

/** Une réponse du serveur, défendue champ par champ (un champ absent : le droit d'avant). */
export function parsePlaybackRights(data: unknown): PlaybackRights {
  const raw = (data ?? {}) as Partial<Record<keyof PlaybackRights, unknown>>;
  const flag = (value: unknown) => value !== false;
  const limit = raw.maxBitrate;
  return {
    mediaPlayback: flag(raw.mediaPlayback),
    videoTranscoding: flag(raw.videoTranscoding),
    audioTranscoding: flag(raw.audioTranscoding),
    remuxing: flag(raw.remuxing),
    maxBitrate: typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? limit : null,
  };
}

export function usePlaybackRights(): PlaybackRightsState {
  const { capabilities, settled: capabilitiesSettled } = useServerCapabilities();
  const capable = capabilities.has("playback.rights");
  const userId = useUserId();
  const query = useQuery({
    queryKey: [PLAYBACK_RIGHTS_KEY, userId],
    queryFn: async () => parsePlaybackRights(await tentacleApiFetch<unknown>("/api/playback/rights")),
    enabled: capable && !!userId,
    staleTime: 30_000,
    retry: 1,
  });
  if (!capable) return { rights: FULL_PLAYBACK_RIGHTS, settled: capabilitiesSettled };
  if (query.data) return { rights: query.data, settled: true };
  return { rights: FULL_PLAYBACK_RIGHTS, settled: query.isError || !userId };
}
