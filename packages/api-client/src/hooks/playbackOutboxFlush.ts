import { JellyfinError } from "../jellyfin/types";
import { stoppedBody } from "./playbackChannelReport";
import { flushPlaybackOutbox, type OutboxFlushResult } from "./playbackOutbox";
import { sessionPost, type JfClient } from "./playbackTransport";

/**
 * Vide la file persistée des rapports (`playbackOutbox`) par le vrai réseau :
 * la dernière lecture que Jellyfin connaît pour le titre — une lecture plus
 * récente que le rapport le rend périmé —, puis l'arrêt, par les mêmes voies
 * que tout report (direct, sinon proxy ; jamais le canal, qui n'arrête que
 * les lectures qu'il a vues commencer).
 */
export function flushPlaybackOutboxFor(client: JfClient, userId: string): Promise<OutboxFlushResult> {
  return flushPlaybackOutbox({
    lastPlayedAt: async (itemId) => {
      try {
        const item = await client.fetch<{ UserData?: { LastPlayedDate?: string } } | undefined>(
          `/Users/${userId}/Items/${itemId}`, undefined, { noAuthExpiry: true },
        );
        const iso = item?.UserData?.LastPlayedDate;
        const at = iso ? Date.parse(iso) : NaN;
        return Number.isFinite(at) ? at : null;
      } catch (error) {
        if (error instanceof JellyfinError && error.status === 404) return "gone";
        throw error;
      }
    },
    sendStop: (state) => sessionPost(client, "/Sessions/Playing/Stopped", stoppedBody(state), "outbox"),
  });
}
