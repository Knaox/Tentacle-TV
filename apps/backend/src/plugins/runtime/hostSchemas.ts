import { z } from "zod";
import type { HostApi, HostMethod } from "./pluginServerRuntime";

/**
 * Les paramètres de CHAQUE méthode de l'API d'hôte, validés avant tout appel
 * (`hostDispatcher.ts`) : ce qui vient de l'invité n'est jamais cru. Bornés en
 * taille (listes, chaînes) pour qu'un invité ne fasse pas travailler l'hôte
 * sans fin. Le résultat, lui, est construit par l'hôte et suit `HostApi`.
 */

const jellyfinId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);
const mbid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
const tool = z.enum(["yt-dlp"]);
const empty = z.object({}).strict();

/** Un événement émis : objet JSON simple et borné ; son `type` est contrôlé à part (PLUGIN_EMITTABLE_MUSIC_EVENTS). */
const eventPayload = z.record(z.unknown()).refine((value) => JSON.stringify(value).length <= 64 * 1024, "événement trop gros");

type ParamSchemas = { [M in HostMethod]: z.ZodType<HostApi[M]["params"]> };

export const HOST_PARAM_SCHEMAS: ParamSchemas = {
  "jellyfin.musicLibrary": empty as unknown as z.ZodType<Record<string, never>>,
  "jellyfin.findByMbid": z.object({ recordings: z.array(mbid).min(1).max(500) }).strict(),
  "jellyfin.setFavorite": z.object({ userId: jellyfinId, itemId: jellyfinId, favorite: z.boolean() }).strict(),
  "jellyfin.playlistInsert": z
    .object({
      userId: jellyfinId,
      playlistId: jellyfinId,
      itemIds: z.array(jellyfinId).min(1).max(200),
      position: z.number().int().min(0).max(1_000_000),
    })
    .strict(),
  "jellyfin.playlistEntries": z.object({ userId: jellyfinId, playlistId: jellyfinId }).strict(),
  "jellyfin.usageOf": z.object({ itemIds: z.array(jellyfinId).min(1).max(100) }).strict(),
  "jellyfin.notifyPath": z
    .object({ path: z.string().min(1).max(1024), change: z.enum(["created", "modified", "deleted"]) })
    .strict(),
  "users.rights": z.object({ userId: jellyfinId }).strict(),
  "events.emit": z.object({ userIds: z.array(jellyfinId).min(1).max(200), event: eventPayload }).strict(),
  "tools.info": z.object({ tool }).strict(),
  "tools.exec": z
    .object({
      tool,
      args: z.array(z.string().max(4096)).max(64),
      timeoutMs: z.number().int().min(1_000).max(600_000),
    })
    .strict(),
  "tools.spawnWorker": z
    .object({
      tool,
      name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
    })
    .strict(),
  "tools.stopWorker": z.object({ workerId: z.string().regex(/^[a-z0-9-]{1,80}$/) }).strict(),
};
