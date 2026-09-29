import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import type { JellyfinUser } from "../middleware/auth";
import { getJellyfinUrl } from "../services/configStore";
import { getPrisma } from "../services/db";
import {
  getSharedStats, isMissingOptionsColumn, readStatsShareOptions, statsShareOptionsOf, writeStatsShareOptions,
} from "../services/shareStats";
import { generateShareToken } from "../services/shareToken";
import type { SharedStatsView, StatsShareLink } from "../services/viewingStats/contractShare";
import { JellyfinUnavailable } from "../services/viewingStats/jellyfinScan";
import { resolveTimeZone } from "../services/viewingStats/localCalendar";
import type { StatsLang } from "../services/viewingStats/present";
import { publicTitleIds } from "../services/viewingStats/publicProjection";

const KIND = "stats";

const saveBody = z.object({
  period: z.enum(["30d", "year", "all"]),
  // Le fuseau de l'appareil du propriétaire : ses jours et ses heures, gardés au serveur.
  tz: z.string().max(64).optional(),
});

const OUTDATED_BASE = { message: "Base à mettre à jour : share_links.options (core-init.sql)" };

/**
 * Les routes du PROPRIÉTAIRE d'un partage de statistiques — le même mécanisme
 * que les listes (un lien par compte, révocation = suppression), plus ses
 * réglages : la période qu'il choisit de montrer, et son fuseau.
 *
 * Déclarées sous `/api/share/stats` : routes statiques, prioritaires sur les
 * paramétriques `/:token` du même préfixe.
 */
export function registerStatsOwnerRoutes(app: FastifyInstance): void {
  // ── POST /stats — crée le lien, ou change sa période (même jeton) ──
  app.post("/stats", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as { user?: JellyfinUser }).user as JellyfinUser;
    const { period, tz } = saveBody.parse(request.body ?? {});
    const options = writeStatsShareOptions({ period, timeZone: resolveTimeZone(tz) });
    try {
      const link = await getPrisma().shareLink.upsert({
        where: { ownerUserId_kind: { ownerUserId: user.userId, kind: KIND } },
        create: { token: generateShareToken(), ownerUserId: user.userId, ownerUsername: user.username, kind: KIND, options },
        update: { ownerUsername: user.username, options },
        select: { token: true },
      });
      return { token: link.token, period } satisfies StatsShareLink;
    } catch (err) {
      if (isMissingOptionsColumn(err)) return reply.status(503).send(OUTDATED_BASE);
      throw err;
    }
  });

  // ── GET /stats/mine — le lien du compte et sa période (null, null sans lien) ──
  app.get("/stats/mine", { preHandler: [requireAuth] }, async (request, reply) => {
    const user = (request as { user?: JellyfinUser }).user as JellyfinUser;
    try {
      const link = await getPrisma().shareLink.findUnique({
        where: { ownerUserId_kind: { ownerUserId: user.userId, kind: KIND } },
        select: { token: true, options: true },
      });
      const out: StatsShareLink = link
        ? { token: link.token, period: readStatsShareOptions(link.options).period }
        : { token: null, period: null };
      return out;
    } catch (err) {
      if (isMissingOptionsColumn(err)) return reply.status(503).send(OUTDATED_BASE);
      throw err;
    }
  });

  // ── DELETE /stats — révoque : le jeton ne mène plus nulle part (404) ──
  app.delete("/stats", { preHandler: [requireAuth] }, async (request) => {
    const user = (request as { user?: JellyfinUser }).user as JellyfinUser;
    await getPrisma().shareLink.deleteMany({ where: { ownerUserId: user.userId, kind: KIND } });
    return { ok: true };
  });
}

/**
 * La vue PUBLIQUE d'un lien de statistiques (sans compte). Jamais mise en
 * cache en chemin : une révocation vaut tout de suite, et le visiteur ne
 * relance aucun calcul (le cache du propriétaire sert).
 */
export async function replySharedStats(
  reply: FastifyReply,
  link: { token: string; ownerUserId: string; ownerUsername: string },
  lang: StatsLang
) {
  reply.header("cache-control", "no-store");
  if (!getJellyfinUrl()) return reply.status(503).send({ message: "Jellyfin non configuré" });
  try {
    const options = await statsShareOptionsOf(link.token);
    if (!options) return reply.status(404).send({ message: "Lien introuvable" });
    const stats = await getSharedStats(link.ownerUserId, options, lang);
    const view: SharedStatsView = { kind: KIND, ownerUsername: link.ownerUsername, stats };
    return view;
  } catch (err) {
    if (isMissingOptionsColumn(err)) return reply.status(503).send(OUTDATED_BASE);
    if (err instanceof JellyfinUnavailable) return reply.status(502).send({ message: "Statistiques indisponibles" });
    throw err;
  }
}

/**
 * Un titre dont la fiche PUBLIQUE peut s'ouvrir depuis un lien de statistiques :
 * seulement l'un de ceux que la page montre — un jeton n'énumère jamais la
 * bibliothèque.
 */
export async function sharedStatsShowsTitle(link: { token: string; ownerUserId: string }, itemId: string): Promise<boolean> {
  const options = await statsShareOptionsOf(link.token);
  if (!options) return false;
  return publicTitleIds(await getSharedStats(link.ownerUserId, options, "fr")).has(itemId);
}
