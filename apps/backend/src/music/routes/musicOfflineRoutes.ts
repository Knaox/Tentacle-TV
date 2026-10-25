/**
 * Octave — `POST /api/music/offline/plan` (capacité `offline.music`) : le plan
 * de la musique de la bibliothèque à garder hors ligne (`offline/offlinePlan.ts`).
 *
 * Le hors ligne appartient au COMPTE DE L'APPAREIL : une session de profil,
 * « voir en tant que » ou une TV n'ont rien (404 générique, comme les routes de
 * téléchargement), ni un compte sans `EnableContentDownloading`. Un titre que le
 * compte ne voit pas n'est jamais planifié (`refused`). Les routes de transfert
 * revérifient tout à chaque fichier.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getTokenFromRequest } from "../../middleware/auth";
import { audioLightAllowed, getUserDownloadPolicy } from "../../services/jellyfinPolicy";
import { rowsByIds } from "../index/indexQueries";
import { normalizeId } from "../jellyfin/musicJellyfin";
import { planTrack } from "../offline/offlinePlan";
import { visibleRows } from "../view/viewContext";
import { userOf, viewOf } from "./requestView";

const PLAN_BODY = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(200) });

export function musicOfflineRoutes(app: FastifyInstance): void {
  app.post("/offline/plan", async (request, reply) => {
    const notFound = () => reply.status(404).send({ error: "not_found" });
    const parsed = PLAN_BODY.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid" });
    const token = getTokenFromRequest(request);
    if (!token || userOf(request).session !== "personal") return notFound();
    const policy = await getUserDownloadPolicy(token);
    if (!policy?.enableContentDownloading) return notFound();

    const ids = [...new Set(parsed.data.ids.map(normalizeId))];
    const rows = visibleRows(await viewOf(request), (await rowsByIds(ids)).values()).filter((row) => row.kind === "track");
    const rights = { light: audioLightAllowed(policy) };
    const planned = new Set(rows.map((row) => row.id));
    reply.header("cache-control", "private, no-store");
    return { tracks: rows.map((row) => planTrack(row, rights)), refused: ids.filter((id) => !planned.has(id)) };
  });
}
