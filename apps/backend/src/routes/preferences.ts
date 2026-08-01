import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { requireAuth, type JellyfinUser } from "../middleware/auth";
import { registerResolveRoute } from "./preferences.resolve";

const upsertSchema = z.object({
  libraryId: z.string().min(1),
  audioLang: z.string().max(10).nullable().optional(),
  subtitleLang: z.string().max(10).nullable().optional(),
  subtitleMode: z.enum(["none", "always", "forced", "signs"]).default("none"),
});

/**
 * Langues retenues pour UN contenu (film ou épisode).
 *
 * `itemId` et non `libraryId` : ces lignes vivent dans leur propre table, pour
 * que `GET /api/preferences` continue de rendre la seule liste des
 * bibliothèques — la page Préférences et le cache hors ligne la lisent, et une
 * ligne par épisode regardé l'aurait fait grossir sans bornes.
 */
const itemUpsertSchema = z.object({
  itemId: z.string().min(1).max(255),
  audioLang: z.string().max(10).nullable().optional(),
  subtitleLang: z.string().max(10).nullable().optional(),
  subtitleMode: z.enum(["none", "always", "forced", "signs"]).default("none"),
});

export const preferenceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // GET /api/preferences — List all user preferences
  app.get("/", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const prefs = await prisma.libraryPreference.findMany({
      where: { jellyfinUserId: user.userId },
    });

    return prefs;
  });

  // GET /api/preferences/language — Get user's interface language
  // Static routes registered before /:libraryId to avoid parametric shadowing
  app.get("/language", async (request, reply) => {
    try {
      const prisma = getPrisma();
      const user = (request as any).user as JellyfinUser;
      const key = `user_lang_${user.userId}`;

      const row = await prisma.serverConfig.findUnique({ where: { key } });
      return { language: row?.value ?? null };
    } catch (err) {
      app.log.error(err, "[preferences/language] Error fetching user language");
      return reply.status(500).send({ message: "Failed to fetch language preference" });
    }
  });

  // PUT /api/preferences/language — Set user's interface language
  app.put("/language", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { language } = z.object({ language: z.string().max(5) }).parse(request.body);
    const key = `user_lang_${user.userId}`;

    await prisma.serverConfig.upsert({
      where: { key },
      create: { key, value: language },
      update: { value: language },
    });

    return { language };
  });

  // ── Préférences PAR CONTENU ──────────────────────────────────────────
  // Enregistrées automatiquement par le lecteur dès que l'utilisateur change de
  // piste, et relues en priorité au visionnage suivant du même contenu (cf.
  // `preferences.resolve.ts`).

  /**
   * GET /api/preferences/items — photo pour le mode hors ligne.
   *
   * BORNÉE aux deux cents plus récentes, comme le miroir local qui la consomme :
   * une entrée par contenu regardé grandit sans fin, et cette réponse est
   * demandée à chaque retour en ligne. Au-delà, la carte n'apporte plus rien —
   * on ne revient pas sur un épisode vu il y a deux cents titres en s'attendant à
   * retrouver sa piste.
   */
  app.get("/items", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    return prisma.itemTrackPreference.findMany({
      where: { jellyfinUserId: user.userId },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: { itemId: true, audioLang: true, subtitleLang: true, subtitleMode: true },
    });
  });

  // GET /api/preferences/item/:itemId
  app.get("/item/:itemId", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { itemId } = request.params as { itemId: string };

    const pref = await prisma.itemTrackPreference.findUnique({
      where: { jellyfinUserId_itemId: { jellyfinUserId: user.userId, itemId } },
    });

    if (!pref) return reply.status(404).send({ message: "No preference found" });
    return pref;
  });

  // PUT /api/preferences/item
  app.put("/item", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const body = itemUpsertSchema.parse(request.body);
    const langs = {
      audioLang: body.audioLang ?? null,
      subtitleLang: body.subtitleLang ?? null,
      subtitleMode: body.subtitleMode,
    };

    return prisma.itemTrackPreference.upsert({
      where: { jellyfinUserId_itemId: { jellyfinUserId: user.userId, itemId: body.itemId } },
      create: { jellyfinUserId: user.userId, itemId: body.itemId, ...langs },
      update: langs,
    });
  });

  // DELETE /api/preferences/item/:itemId — revenir aux préférences de série puis
  // de bibliothèque pour ce contenu.
  app.delete("/item/:itemId", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { itemId } = request.params as { itemId: string };

    try {
      await prisma.itemTrackPreference.delete({
        where: { jellyfinUserId_itemId: { jellyfinUserId: user.userId, itemId } },
      });
      return { success: true };
    } catch {
      return reply.status(404).send({ message: "Preference not found" });
    }
  });

  // GET /api/preferences/:libraryId — Get preference for a specific library
  app.get("/:libraryId", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { libraryId } = request.params as { libraryId: string };

    const pref = await prisma.libraryPreference.findUnique({
      where: {
        jellyfinUserId_libraryId: {
          jellyfinUserId: user.userId,
          libraryId,
        },
      },
    });

    if (!pref) {
      return reply.status(404).send({ message: "No preference found" });
    }

    return pref;
  });

  // PUT /api/preferences — Upsert a library preference
  app.put("/", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const body = upsertSchema.parse(request.body);

    const pref = await prisma.libraryPreference.upsert({
      where: {
        jellyfinUserId_libraryId: {
          jellyfinUserId: user.userId,
          libraryId: body.libraryId,
        },
      },
      create: {
        jellyfinUserId: user.userId,
        libraryId: body.libraryId,
        audioLang: body.audioLang ?? null,
        subtitleLang: body.subtitleLang ?? null,
        subtitleMode: body.subtitleMode,
      },
      update: {
        audioLang: body.audioLang ?? null,
        subtitleLang: body.subtitleLang ?? null,
        subtitleMode: body.subtitleMode,
      },
    });

    return pref;
  });

  // DELETE /api/preferences/:libraryId — Delete a library preference
  app.delete("/:libraryId", async (request, reply) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const { libraryId } = request.params as { libraryId: string };

    try {
      await prisma.libraryPreference.delete({
        where: {
          jellyfinUserId_libraryId: {
            jellyfinUserId: user.userId,
            libraryId,
          },
        },
      });
      return { success: true };
    } catch {
      return reply.status(404).send({ message: "Preference not found" });
    }
  });

  registerResolveRoute(app);
};
