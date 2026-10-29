/**
 * Octave — les routes MUSIQUE du cœur (`/api/music/*`, contrat
 * `MUSIC_ROUTES`), servies sous la capacité `music.library`. Toutes exigent la
 * session (`requireAuth`, profils de la Famille compris : ils écoutent) et
 * suivent les droits Jellyfin du compte : ce qu'il ne voit pas répond 404 ou
 * une liste vide — jamais une erreur qui trahirait l'existence d'un élément.
 */

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { requireAuth } from "../../middleware/auth";
import { ensureMusicIndex } from "../musicService";
import type { ListOrder } from "../index/indexQueries";
import { albumsPageView, albumView, artistsPageView, artistView, searchView, statusView } from "../view/libraryViews";
import { homeView } from "../view/userViews";
import { clampLimit, parseCursor } from "../view/viewContext";
import { musicMediaRoutes } from "./musicMediaRoutes";
import { musicUserRoutes } from "./musicUserRoutes";
import { musicListRoutes } from "./musicListRoutes";
import { musicOfflineRoutes } from "./musicOfflineRoutes";
import { musicImportRoutes } from "../playlistImport/importRoutes";
import { musicSourceOrderRoutes } from "../playlistSource/sourceRoutes";
import { musicShareOwnerRoutes } from "../playlistShare/shareRoutes";
import { musicSharedLinkRoutes } from "../sharedLinks/sharedLinkRoutes";
import { musicPlaylistMemberRoutes } from "../playlistMembers/memberRoutes";
import { applyQueryToken } from "./mediaQueryToken";
import { octaveAccessGate } from "./octaveAccessGate";
import { capabilityGate } from "../../serverCapabilities/declaredCapabilities";
import { viewOf } from "./requestView";

const ORDERS: readonly ListOrder[] = ["name", "recent", "year"];

function libraryRoutes(app: FastifyInstance): void {
  app.get("/status", async (request) => statusView(await viewOf(request)));

  app.get<{ Querystring: { q?: string; limit?: string } }>("/search", async (request, reply) => {
    const startedAt = Date.now();
    const query = (request.query.q ?? "").slice(0, 200);
    const tracks = clampLimit(request.query.limit, 20, 50);
    const half = Math.max(1, Math.ceil(tracks / 2));
    reply.header("cache-control", "private, no-store");
    return searchView(await viewOf(request), query, { tracks, albums: half, artists: half, playlists: half }, startedAt);
  });

  app.get<{ Querystring: { cursor?: string; limit?: string; sort?: string } }>("/albums", async (request) => {
    const sort = ORDERS.find((o) => o === request.query.sort) ?? "name";
    return albumsPageView(await viewOf(request), parseCursor(request.query.cursor), clampLimit(request.query.limit, 50, 200), sort);
  });

  app.get<{ Params: { id: string } }>("/albums/:id", async (request, reply) => {
    const album = await albumView(await viewOf(request), request.params.id);
    return album ?? reply.status(404).send({ error: "not_found" });
  });

  app.get<{ Querystring: { cursor?: string; limit?: string } }>("/artists", async (request) =>
    artistsPageView(await viewOf(request), parseCursor(request.query.cursor), clampLimit(request.query.limit, 50, 200)),
  );

  app.get<{ Params: { id: string } }>("/artists/:id", async (request, reply) => {
    const artist = await artistView(await viewOf(request), request.params.id);
    return artist ?? reply.status(404).send({ error: "not_found" });
  });

  app.get("/home", async (request, reply) => {
    reply.header("cache-control", "private, no-store");
    return homeView(await viewOf(request));
  });
}

export const musicRoutes: FastifyPluginAsync = async (app) => {
  // Serveur sous la version de `music.library` : ces routes n'existent pas (404 `not_available`), aucun index ne part.
  app.addHook("onRequest", capabilityGate("music.library"));
  app.addHook("preHandler", requireAuth);
  // « Accès à Octave » et « Lecture des médias » du compte (octaveAccessGate.ts).
  app.addHook("preHandler", octaveAccessGate);
  // Premier appel après un démarrage sans passage complet : il part en fond.
  app.addHook("onRequest", async (request) => {
    ensureMusicIndex();
    // `?api_key=` : GET du flux et des pochettes SEULEMENT (un <audio> ne pose pas d'en-tête).
    applyQueryToken(request);
  });
  libraryRoutes(app);
  musicUserRoutes(app);
  musicMediaRoutes(app);
  musicOfflineRoutes(app);
  musicImportRoutes(app);
  musicSourceOrderRoutes(app);
  musicShareOwnerRoutes(app);
  musicSharedLinkRoutes(app);
  musicPlaylistMemberRoutes(app);
  // Encapsulé : le garde de `music.listOrder` ne touche que ses routes.
  await app.register(async (scope) => musicListRoutes(scope));
};
