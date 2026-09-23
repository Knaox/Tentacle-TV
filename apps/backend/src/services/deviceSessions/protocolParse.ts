import { z } from "zod";
import type { PlaybackStateDto, SessionClientMessage } from "./protocolMessages";

/**
 * Canal de session — validation de forme des messages entrants (payloads non
 * fiables). Ce qui en sort part vers Jellyfin : chaque champ est borné ici,
 * et rien de ce que le client écrit n'atterrit dans un en-tête.
 */

/** Identifiant Jellyfin (GUID avec ou sans tirets) ou session de lecture. */
const id = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);
const ticks = z.number().finite().nonnegative().max(1e15);
const streamIndex = z.number().int().min(-1).max(1_000);

const state = z.object({
  itemId: id,
  mediaSourceId: id.optional(),
  playSessionId: id.optional(),
  playMethod: z.enum(["DirectPlay", "DirectStream", "Transcode"]),
  positionTicks: ticks,
  isPaused: z.boolean(),
  audioStreamIndex: streamIndex.optional(),
  subtitleStreamIndex: streamIndex.optional(),
  canSeek: z.boolean().optional(),
  volumeLevel: z.number().min(0).max(100).optional(),
  isMuted: z.boolean().optional(),
});

const message = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session:hello"),
    version: z.number().int().positive(),
    deviceId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  }),
  z.object({ type: z.literal("playback:start"), state, resumed: z.boolean().optional() }),
  z.object({
    type: z.literal("playback:progress"),
    event: z.enum(["tick", "pause", "unpause", "seek", "tracks", "volume"]),
    state,
  }),
  z.object({ type: z.literal("playback:stop"), state, requestId: z.string().min(1).max(64) }),
]);

/** Les types que ce canal traite — le routeur de `/api/ws` aiguille sur eux. */
export function isSessionMessageType(type: string): boolean {
  return type.startsWith("session:") || type.startsWith("playback:");
}

/** Message bien formé, ou `null`. */
export function parseSessionMessage(raw: unknown): SessionClientMessage | null {
  const parsed = message.safeParse(raw);
  if (!parsed.success) return null;
  // Arrondi des ticks : Jellyfin les veut entiers (Int64).
  if ("state" in parsed.data) {
    const s: PlaybackStateDto = { ...parsed.data.state, positionTicks: Math.floor(parsed.data.state.positionTicks) };
    return { ...parsed.data, state: s } as SessionClientMessage;
  }
  return parsed.data;
}
