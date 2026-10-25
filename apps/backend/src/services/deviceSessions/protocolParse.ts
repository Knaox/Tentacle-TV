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

/** Un texte affiché dans le tableau de bord : borné, jamais vide. */
const label = z.string().trim().min(1).max(300);

/**
 * La pochette d'une écoute déclarée : un chemin de NOTRE serveur (`/api/…`, sans
 * `..` ni retour d'hôte `//`) ou une adresse https publique — jamais un
 * `javascript:`, un `data:` ni un autre schéma.
 */
const imageUrl = z.string().max(2_048).refine(
  (url) => (/^\/api\/[^\s]*$/.test(url) && !url.includes("..")) || /^https:\/\/[^\s/]+\/[^\s]*$/i.test(url),
);

const declared = z.object({
  key: z.string().min(1).max(512),
  itemId: id.optional(),
  title: label,
  artists: label.optional(),
  album: label.optional(),
  imageUrl: imageUrl.optional(),
  durationMs: z.number().finite().positive().max(1e10).optional(),
  positionMs: z.number().finite().nonnegative().max(1e10),
  isPaused: z.boolean(),
});

const message = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("session:hello"),
    version: z.number().int().positive(),
    deviceId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
    // Des étiquettes lisibles, ASCII imprimable sans guillemet : elles
    // finissent dans un en-tête `MediaBrowser`, que Kestrel refuse hors ASCII.
    client: z.string().regex(/^[\x20-\x21\x23-\x7E]{1,64}$/).optional(),
    device: z.string().regex(/^[\x20-\x21\x23-\x7E]{1,64}$/).optional(),
    appVersion: z.string().regex(/^[0-9A-Za-z.+-]{1,32}$/).optional(),
  }),
  z.object({ type: z.literal("playback:start"), state, resumed: z.boolean().optional() }),
  z.object({
    type: z.literal("playback:progress"),
    event: z.enum(["tick", "pause", "unpause", "seek", "tracks", "volume"]),
    state,
  }),
  z.object({ type: z.literal("playback:stop"), state, requestId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("playback:declare"), state: declared.nullable() }),
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
  if (parsed.data.type === "playback:declare") {
    const d = parsed.data.state;
    return { type: "playback:declare", state: d === null ? null : { ...d, positionMs: Math.floor(d.positionMs) } };
  }
  if ("state" in parsed.data) {
    const s: PlaybackStateDto = { ...parsed.data.state, positionTicks: Math.floor(parsed.data.state.positionTicks) };
    return { ...parsed.data, state: s } as SessionClientMessage;
  }
  return parsed.data;
}
