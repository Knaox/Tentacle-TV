/**
 * Octave — les routes des FAVORIS de la bibliothèque et de l'ordre de ses rubriques (capacité
 * `music.libraryFavorites`, contrat `musicLibraryShelves.ts`) :
 * - `GET /library/shelves` : les favoris et l'ordre de chaque rubrique ;
 * - `PUT /library/favorite` : un album, un artiste, une playlist — le favori JELLYFIN pour la bibliothèque ; celui
 *   de TENTACLE pour une playlist reçue (Jellyfin la refuse au membre) et pour un élément d'une extension ;
 * - `PUT /library/order/:section` : l'ordre personnel d'une rubrique.
 * Les autres appareils du compte l'apprennent (`music:userdata` pour un favori Jellyfin, `music:shelves` toujours).
 */

import type { FastifyInstance, FastifyReply } from "fastify";
import { capabilityGate } from "../../serverCapabilities/declaredCapabilities";
import { sendToUser } from "../../services/wsManager";
import { writeFavorite } from "../access/userFavorites";
import { parseShelfOrder, parseShelfSection, shelfKeyOf, type MusicShelfFavoriteOutcome, type MusicShelfSection } from "../contract/musicLibraryShelves";
import { musicMessage } from "../events/musicSend";
import { rowById } from "../index/indexQueries";
import { isJellyfinId, normalizeId } from "../jellyfin/musicJellyfin";
import { writeShelfOrder } from "../listOrder/shelfOrderStore";
import { playlistAccess } from "../playlistMembers/playlistAccess";
import { forgetUserPlaylists } from "../playlists/playlistJellyfin";
import { userOf, viewOf } from "../routes/requestView";
import { visibleRows, type UserView } from "../view/viewContext";
import { writeShelfFavorite } from "./shelfFavoriteStore";
import { parseExternalRef, shelfSnapshot } from "./shelfSnapshot";
import { shelvesView } from "./shelvesView";

type Result = { ok: true; jellyfin: boolean } | { ok: false; status: number; error: string };

const KIND: Record<Exclude<MusicShelfSection, "playlists">, "album" | "artist"> = { albums: "album", artists: "artist" };

/** Un élément de la bibliothèque : le favori Jellyfin, sauf pour une playlist reçue (gardé par Tentacle). */
async function libraryFavorite(view: UserView, section: MusicShelfSection, rawId: string, favorite: boolean): Promise<Result> {
  const id = normalizeId(rawId);
  if (section === "playlists") {
    const access = await playlistAccess(view.userId, id);
    if (!access) return { ok: false, status: 404, error: "not_found" };
    if (access.readerId !== normalizeId(view.userId)) {
      await writeShelfFavorite(view.userId, section, shelfKeyOf({ jellyfinId: id }), favorite, null);
      return { ok: true, jellyfin: false };
    }
    if (!(await writeFavorite(view.userId, id, favorite))) return { ok: false, status: 503, error: "unavailable" };
    forgetUserPlaylists(view.userId);
    return { ok: true, jellyfin: true };
  }
  const row = await rowById(id);
  if (!row || row.kind !== KIND[section] || visibleRows(view, [row]).length === 0) return { ok: false, status: 404, error: "not_found" };
  if (!(await writeFavorite(view.userId, row.id, favorite))) return { ok: false, status: 503, error: "unavailable" };
  return { ok: true, jellyfin: true };
}

const SNAPSHOT_FIELD: Record<MusicShelfSection, "album" | "artist" | "playlist"> = { albums: "album", artists: "artist", playlists: "playlist" };

function fail(reply: FastifyReply, status: number, error: string) {
  return reply.status(status).send({ error });
}

export function musicShelfRoutes(app: FastifyInstance): void {
  // Sous la version de la capacité, ces routes n'existent pas.
  app.addHook("onRequest", capabilityGate("music.libraryFavorites"));

  app.get("/library/shelves", async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    return shelvesView(await viewOf(request));
  });

  app.put<{ Body: Record<string, unknown> | undefined }>("/library/favorite", async (request, reply) => {
    const body = request.body ?? {};
    const section = parseShelfSection(body.section);
    const favorite = body.favorite;
    if (!section || typeof favorite !== "boolean") return fail(reply, 400, "invalid_input");
    const view = await viewOf(request);
    if (view.access.mode === "none") return fail(reply, 404, "not_found");
    const account = userOf(request).userId;
    let key: string;
    if (typeof body.jellyfinId === "string") {
      if (!isJellyfinId(body.jellyfinId)) return fail(reply, 400, "invalid_input");
      const result = await libraryFavorite(view, section, body.jellyfinId, favorite);
      if (!result.ok) return fail(reply, result.status, result.error);
      const jellyfinId = normalizeId(body.jellyfinId);
      key = shelfKeyOf({ jellyfinId });
      if (result.jellyfin) sendToUser(account, musicMessage({ type: "music:userdata", changes: [{ jellyfinId, favorite }] }));
    } else {
      // Un élément d'une extension : sa référence, et l'instantané de sa carte pour le poser.
      const external = parseExternalRef(body.external);
      if (!external) return fail(reply, 400, "invalid_input");
      const snapshot = favorite ? shelfSnapshot(section, external, body[SNAPSHOT_FIELD[section]]) : null;
      if (favorite && !snapshot) return fail(reply, 400, "invalid_input");
      key = shelfKeyOf({ jellyfinId: null, external });
      await writeShelfFavorite(view.userId, section, key, favorite, snapshot ? JSON.stringify(snapshot) : null);
    }
    sendToUser(account, musicMessage({ type: "music:shelves", section }));
    const outcome: MusicShelfFavoriteOutcome = { section, key, favorite };
    return outcome;
  });

  app.put<{ Params: { section: string }; Body: unknown }>("/library/order/:section", async (request, reply) => {
    const section = parseShelfSection(request.params.section);
    const keys = parseShelfOrder(request.body);
    if (!section || !keys) return fail(reply, 400, "invalid_input");
    await writeShelfOrder(userOf(request).userId, section, keys);
    sendToUser(userOf(request).userId, musicMessage({ type: "music:shelves", section }));
    return { section, keys };
  });
}
