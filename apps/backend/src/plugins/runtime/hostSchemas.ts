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
const text = (max: number) => z.string().max(max);
const matchTrack = z
  .object({
    ref: z.string().min(1).max(200),
    title: text(500).min(1),
    artists: z.array(z.object({ name: text(500), mbid: mbid.nullable() }).strict()).max(20),
    albumTitle: text(500).nullable(),
    durationMs: z.number().int().min(0).max(86_400_000).nullable(),
    recording: mbid.nullable(),
  })
  .strict();

/** Un événement émis : objet JSON simple et borné ; son `type` est contrôlé à part (PLUGIN_EMITTABLE_MUSIC_EVENTS). */
const eventPayload = z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 64 * 1024, "événement trop gros");

type ParamSchemas = { [M in HostMethod]: z.ZodType<HostApi[M]["params"]> };

export const HOST_PARAM_SCHEMAS: ParamSchemas = {
  "jellyfin.musicLibrary": empty as unknown as z.ZodType<Record<string, never>>,
  "jellyfin.findByMbid": z.object({ recordings: z.array(mbid).min(1).max(500) }).strict(),
  "jellyfin.matchTracks": z.object({ userId: jellyfinId, tracks: z.array(matchTrack).min(1).max(200) }).strict(),
  "jellyfin.setFavorite": z.object({ userId: jellyfinId, itemId: jellyfinId, favorite: z.boolean() }).strict(),
  "jellyfin.playlistInsert": z
    .object({
      userId: jellyfinId,
      playlistId: jellyfinId,
      itemIds: z.array(jellyfinId).min(1).max(200),
      position: z.number().int().min(0).max(1_000_000),
      sourceIndex: z.number().int().min(0).max(1_000_000).optional(),
    })
    .strict(),
  "jellyfin.playlistEntries": z.object({ userId: jellyfinId, playlistId: jellyfinId }).strict(),
  "jellyfin.playlistEditable": z.object({ userId: jellyfinId, playlistId: jellyfinId }).strict(),
  "jellyfin.usageOf": z.object({ itemIds: z.array(jellyfinId).min(1).max(100) }).strict(),
  "jellyfin.notifyPath": z
    .object({ path: z.string().min(1).max(1024), change: z.enum(["created", "modified", "deleted"]) })
    .strict(),
  // Absolu (POSIX ou lecteur Windows), borné, sans « .. » ni octet nul ; la bibliothèque est vérifiée par l'hôte.
  "jellyfin.refreshPath": z
    .object({
      path: z
        .string()
        .min(2)
        .max(1024)
        .regex(/^(\/|[A-Za-z]:[\\/])/, "chemin absolu attendu")
        .refine((p) => !/(^|[\\/])\.\.([\\/]|$)/.test(p) && !p.includes("\0"), "chemin invalide"),
    })
    .strict(),
  "users.rights": z.object({ userId: jellyfinId }).strict(),
  "users.list": empty as unknown as z.ZodType<Record<string, never>>,
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
  // Un coût hors 1..4 est refusé : une extension ne réserve pas l'heure d'un coup.
  "tools.youtubeAdmit": z.object({ kind: z.enum(["play", "prefetch"]), cost: z.number().int().min(1).max(4) }).strict(),
  "tools.youtubeReport": z.object({ outcome: z.enum(["ok", "antiBot"]), startedAt: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict(),
  // La forme seulement : hôtes, en-têtes et tailles sont jugés contre le manifeste par le courtier.
  "client.fetch": z
    .object({
      client: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
      request: z
        .object({
          method: z.enum(["GET", "POST"]),
          url: z.string().min(8).max(4096),
          headers: z.record(z.string(), z.string().max(8192)).optional(),
          body: z.string().max(256 * 1024).optional(),
          timeoutMs: z.number().int().min(1).max(8_000).optional(),
          maxBytes: z.number().int().min(1).max(2 * 1024 * 1024).optional(),
          // Geste ou fond : le budget par adresse de sortie sert les gestes d'abord (`clientFetch/egressBudget.ts`).
          kind: z.enum(["play", "prefetch"]).optional(),
        })
        .strict(),
    })
    .strict(),
};
