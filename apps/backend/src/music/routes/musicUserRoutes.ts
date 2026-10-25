/**
 * Octave — ce qui appartient au COMPTE, dans Jellyfin : son cœur (favori),
 * « Titres likés », ses playlists, la recherche par MBID d'enregistrement, et
 * ce que sa bibliothèque a parmi des titres d'ailleurs (`/match`).
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { writeFavorite } from "../access/userFavorites";
import { rowById } from "../index/indexQueries";
import { isJellyfinId, normalizeId } from "../jellyfin/musicJellyfin";
import {
  createPlaylist,
  deletePlaylist,
  insertIntoPlaylist,
  moveInPlaylist,
  removeFromPlaylist,
  renamePlaylist,
  type PlaylistResult,
} from "../playlists/playlistService";
import { playlistDetail, playlistsView } from "../view/playlistViews";
import { byMbidView, likedView } from "../view/userViews";
import { parseMatchRequest } from "../view/matchInput";
import { matchView } from "../view/matchViews";
import { clampLimit, parseCursor, visibleRows, type UserView } from "../view/viewContext";
import { sendToUser } from "../../services/wsManager";
import { musicMessage } from "../events/musicSend";
import { userOf, viewOf } from "./requestView";

const STATUS = { not_found: 404, forbidden: 403, invalid: 400, unavailable: 503 } as const;

function answer<T>(reply: FastifyReply, result: PlaylistResult<T>, ok: (value: T) => unknown) {
  return result.ok ? ok(result.value) : reply.status(STATUS[result.failure]).send({ error: result.failure });
}

function playlistName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 200 ? name : null;
}

/** Les titres que le compte peut mettre dans une playlist : visibles, de l'index. `null` si un identifiant est mal formé. */
async function playableIds(view: UserView, value: unknown): Promise<string[] | null> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500 || !value.every(isJellyfinId)) return null;
  const ids: string[] = [];
  for (const raw of value as string[]) {
    const row = await rowById(normalizeId(raw));
    if (row && row.kind === "track" && visibleRows(view, [row]).length > 0) ids.push(row.id);
  }
  return ids;
}

function position(value: unknown): number | undefined | null {
  if (value === undefined || value === null) return undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function musicUserRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { cursor?: string; limit?: string } }>("/liked", async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    return likedView(await viewOf(request), parseCursor(request.query.cursor), clampLimit(request.query.limit, 100, 500));
  });

  app.put<{ Params: { id: string }; Body: { favorite?: unknown } }>("/favorite/:id", async (request, reply) => {
    const favorite = request.body?.favorite;
    if (typeof favorite !== "boolean" || !isJellyfinId(request.params.id)) return reply.status(400).send({ error: "invalid_input" });
    const view = await viewOf(request);
    const row = await rowById(normalizeId(request.params.id));
    if (!row || visibleRows(view, [row]).length === 0) return reply.status(404).send({ error: "not_found" });
    if (!(await writeFavorite(view.userId, row.id, favorite))) return reply.status(503).send({ error: "unavailable" });
    // Les autres appareils du compte l'apprennent tout de suite (Jellyfin le redira ; le doublon est sans effet).
    sendToUser(userOf(request).userId, musicMessage({ type: "music:userdata", changes: [{ jellyfinId: row.id, favorite }] }));
    return { jellyfinId: row.id, favorite };
  });

  app.get("/playlists", async (request) => playlistsView(await viewOf(request)));

  app.post<{ Body: { name?: unknown; itemIds?: unknown } }>("/playlists", async (request, reply) => {
    const view = await viewOf(request);
    const name = playlistName(request.body?.name);
    const ids = await playableIds(view, request.body?.itemIds);
    if (!name || !ids) return reply.status(400).send({ error: "invalid_input" });
    if (view.access.mode === "none") return reply.status(404).send({ error: "not_found" });
    const created = await createPlaylist(view.userId, name, ids);
    if (!created.ok) return reply.status(STATUS[created.failure]).send({ error: created.failure });
    return (await playlistDetail(view, created.value)) ?? reply.status(503).send({ error: "unavailable" });
  });

  app.get<{ Params: { id: string } }>("/playlists/:id", async (request, reply) => {
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    const detail = await playlistDetail(await viewOf(request), request.params.id);
    return detail ?? reply.status(404).send({ error: "not_found" });
  });

  app.patch<{ Params: { id: string }; Body: { name?: unknown } }>("/playlists/:id", async (request, reply) => {
    const name = playlistName(request.body?.name);
    if (!name || !isJellyfinId(request.params.id)) return reply.status(400).send({ error: "invalid_input" });
    const view = await viewOf(request);
    return answer(reply, await renamePlaylist(view.userId, request.params.id, name), async () => playlistDetail(view, request.params.id));
  });

  app.delete<{ Params: { id: string } }>("/playlists/:id", async (request, reply) => {
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    const view = await viewOf(request);
    return answer(reply, await deletePlaylist(view.userId, request.params.id), () => ({ ok: true }));
  });

  app.post<{ Params: { id: string }; Body: { itemIds?: unknown; position?: unknown } }>("/playlists/:id/entries", async (request, reply) => {
    const view = await viewOf(request);
    const ids = await playableIds(view, request.body?.itemIds);
    const at = position(request.body?.position);
    if (!ids || ids.length === 0 || at === null || !isJellyfinId(request.params.id)) return reply.status(400).send({ error: "invalid_input" });
    return answer(reply, await insertIntoPlaylist(view.userId, request.params.id, ids, at), async () => playlistDetail(view, request.params.id));
  });

  app.patch<{ Params: { id: string; entryId: string }; Body: { position?: unknown } }>("/playlists/:id/entries/:entryId", async (request, reply) => {
    const at = position(request.body?.position);
    if (at === undefined || at === null || !isJellyfinId(request.params.id)) return reply.status(400).send({ error: "invalid_input" });
    const view = await viewOf(request);
    return answer(reply, await moveInPlaylist(view.userId, request.params.id, request.params.entryId, at), async () => playlistDetail(view, request.params.id));
  });

  app.delete<{ Params: { id: string; entryId: string } }>("/playlists/:id/entries/:entryId", async (request, reply) => {
    if (!isJellyfinId(request.params.id)) return reply.status(404).send({ error: "not_found" });
    const view = await viewOf(request);
    return answer(reply, await removeFromPlaylist(view.userId, request.params.id, request.params.entryId), async () => playlistDetail(view, request.params.id));
  });

  app.post<{ Body: { recordings?: unknown } }>("/by-mbid", async (request, reply) => {
    const recordings = request.body?.recordings;
    if (!Array.isArray(recordings) || recordings.length > 200) return reply.status(400).send({ error: "invalid_input" });
    return byMbidView(await viewOf(request), recordings);
  });

  app.post("/match", async (request, reply) => {
    const parsed = parseMatchRequest(request.body);
    if (!parsed) return reply.status(400).send({ error: "invalid_input" });
    reply.header("cache-control", "private, no-store");
    return matchView(await viewOf(request), parsed);
  });
}
