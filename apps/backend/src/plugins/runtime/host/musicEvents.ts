import { z } from "zod";
import { HostCallFailure } from "../hostDispatcher";
import { runtimeServices, type RuntimeMusicEvent } from "../hostServices";

/**
 * Les événements musique d'une extension (`events.emit`). Seuls les types que
 * le contrat lui permet (`PLUGIN_EMITTABLE_MUSIC_EVENTS` de shared :
 * `music:resolved`, `music:pending`), à la forme du contrat ; `pluginId` est
 * TOUJOURS le sien, posé par l'hôte — une extension ne parle jamais au nom
 * d'une autre. Le transport est celui du cœur (`hostServices.ts`).
 */

/** Recopié du contrat (shared/music/musicEvents.ts) : le backend ne dépend pas de shared. */
export const PLUGIN_EMITTABLE_MUSIC_EVENTS = ["music:resolved", "music:pending"] as const;

const mbid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const emittable = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("music:resolved"),
    externalId: z.string().regex(/^[A-Za-z0-9._~:@-]{1,200}$/),
    jellyfinId: z.string().regex(/^[A-Za-z0-9-]{1,64}$/),
    recording: mbid.nullable(),
    // Un titre du contrat (`MusicTrack`) ou rien : le cœur le relaie, il ne l'interprète pas.
    track: z.record(z.string(), z.unknown()).nullable(),
  }),
  z.object({ type: z.literal("music:pending") }),
]);

/**
 * `music:resolved` : le titre RELAYÉ est celui de la bibliothèque (index du cœur, compte par compte) — pochette,
 * titre, artistes, album, durée de l'élément Jellyfin, jamais la fiche que l'extension avait à l'ajout (Damien,
 * 26/10 : « l'image ne s'actualise pas »). Pas encore indexé : le titre de l'extension, comme avant.
 */
export async function emitPluginMusicEvent(pluginId: string, userIds: string[], event: Record<string, unknown>): Promise<{ delivered: number }> {
  if (typeof event.type !== "string" || !(PLUGIN_EMITTABLE_MUSIC_EVENTS as readonly string[]).includes(event.type)) {
    throw new HostCallFailure("forbidden", "type d'événement non permis à une extension");
  }
  const parsed = emittable.safeParse(event);
  if (!parsed.success) throw new HostCallFailure("invalid", "événement mal formé");
  const message: RuntimeMusicEvent = { ...parsed.data, pluginId };
  const { libraryTrack, sendMusicEvent } = runtimeServices();
  if (message.type !== "music:resolved" || !libraryTrack) return { delivered: sendMusicEvent(userIds, message) };
  let delivered = 0;
  for (const userId of new Set(userIds)) {
    const track = await libraryTrack(userId, message.jellyfinId).catch(() => null);
    delivered += sendMusicEvent([userId], track ? { ...message, track } : message);
  }
  return { delivered };
}

/** Une extension musique est apparue, a été coupée ou a changé : chaque client relit `/api/plugins/active`. */
export function broadcastMusicProvider(): void {
  runtimeServices().broadcastMusicEvent({ type: "music:provider" });
}
