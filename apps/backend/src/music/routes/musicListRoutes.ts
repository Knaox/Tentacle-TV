/**
 * Octave — l'ORDRE des listes (capacité `music.listOrder`, contrat
 * `musicListOrder.ts`) : la préférence d'ordre d'une liste, par compte, et la
 * réécriture de l'ordre d'une playlist Jellyfin après un glisser.
 */

import type { FastifyInstance } from "fastify";
import { isCapabilityDeclared } from "../../serverCapabilities/declaredCapabilities";
import { parseListKey, parseListPrefs } from "../contract/musicListOrder";
import { isJellyfinId } from "../jellyfin/musicJellyfin";
import { readListPrefs, writeListPrefs } from "../listOrder/listPrefsStore";
import { playlistAccess } from "../playlistMembers/playlistAccess";
import { reorderPlaylist } from "../playlists/playlistService";
import { tellListPrefsChanged } from "../events/musicLiveEvents";
import { userOf, viewOf } from "./requestView";

const STATUS = { not_found: 404, forbidden: 403, invalid: 400, unavailable: 503 } as const;

export function musicListRoutes(app: FastifyInstance): void {
  // Sous la version de la capacité, ces routes n'existent pas (comme toute route de `music.library`).
  app.addHook("onRequest", async (_request, reply) => {
    if (!isCapabilityDeclared("music.listOrder")) return reply.status(404).send({ error: "not_available" });
  });

  app.get<{ Params: { key: string } }>("/lists/:key/prefs", async (request, reply) => {
    const key = parseListKey(request.params.key);
    if (!key) return reply.status(400).send({ error: "invalid_input" });
    reply.header("cache-control", "private, no-store");
    return readListPrefs(userOf(request).userId, key);
  });

  app.put<{ Params: { key: string }; Body: unknown }>("/lists/:key/prefs", async (request, reply) => {
    const key = parseListKey(request.params.key);
    const prefs = parseListPrefs(request.body);
    if (!key || !prefs) return reply.status(400).send({ error: "invalid_input" });
    // Une playlist que le compte ne voit pas n'a pas de préférence (rien ne trahit son existence).
    if (key !== "liked") {
      const view = await viewOf(request);
      if (view.access.mode === "none" || !(await playlistAccess(view.userId, key.slice("playlist:".length)))) return reply.status(404).send({ error: "not_found" });
    }
    await writeListPrefs(userOf(request).userId, key, prefs);
    // Les autres appareils du compte relisent ce tri (l'appareil qui l'a gardé ignore son propre écho).
    tellListPrefsChanged(userOf(request).userId, key);
    return prefs;
  });

  app.put<{ Params: { id: string }; Body: { entryIds?: unknown } }>("/playlists/:id/order", async (request, reply) => {
    const entryIds = request.body?.entryIds;
    if (!isJellyfinId(request.params.id) || !Array.isArray(entryIds) || entryIds.length > 10_000 || !entryIds.every((e) => typeof e === "string" && e.length > 0 && e.length <= 64)) {
      return reply.status(400).send({ error: "invalid_input" });
    }
    const result = await reorderPlaylist(userOf(request).userId, request.params.id, entryIds as string[]);
    return result.ok ? { ok: true } : reply.status(STATUS[result.failure]).send({ error: result.failure });
  });
}
