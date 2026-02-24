import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { requireAuth, type TokenPayload } from "../middleware/auth";

const prisma = new PrismaClient();

const upsertSchema = z.object({
  libraryId: z.string().min(1),
  audioLang: z.string().max(10).nullable().optional(),
  subtitleLang: z.string().max(10).nullable().optional(),
  subtitleMode: z.enum(["none", "always", "forced", "signs"]).default("none"),
});

export const preferenceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // GET /api/preferences — List all user preferences
  app.get("/", async (request) => {
    const user = (request as any).user as TokenPayload;

    const prefs = await prisma.libraryPreference.findMany({
      where: { jellyfinUserId: user.userId },
    });

    return prefs;
  });

  // GET /api/preferences/:libraryId — Get preference for a specific library
  app.get("/:libraryId", async (request, reply) => {
    const user = (request as any).user as TokenPayload;
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
    const user = (request as any).user as TokenPayload;
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
    const user = (request as any).user as TokenPayload;
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

  // POST /api/preferences/resolve — Resolve best tracks for a media item
  app.post("/resolve", async (request) => {
    const user = (request as any).user as TokenPayload;
    const body = request.body as {
      libraryId: string;
      audioTracks: Array<{ index: number; language?: string; isDefault?: boolean }>;
      subtitleTracks: Array<{ index: number; language?: string; isForced?: boolean; title?: string }>;
    };

    const pref = await prisma.libraryPreference.findUnique({
      where: {
        jellyfinUserId_libraryId: {
          jellyfinUserId: user.userId,
          libraryId: body.libraryId,
        },
      },
    });

    // No preference set — use defaults
    if (!pref) {
      return {
        audioIndex: body.audioTracks.find((t) => t.isDefault)?.index ?? body.audioTracks[0]?.index ?? null,
        subtitleIndex: null,
      };
    }

    // Resolve audio: prefer matching language, fallback to default
    let audioIndex = body.audioTracks.find((t) => t.isDefault)?.index ?? body.audioTracks[0]?.index ?? null;
    if (pref.audioLang) {
      const match = body.audioTracks.find((t) => t.language === pref.audioLang);
      if (match) audioIndex = match.index;
    }

    // Resolve subtitle based on mode
    let subtitleIndex: number | null = null;
    if (pref.subtitleMode !== "none" && pref.subtitleLang) {
      const subs = body.subtitleTracks.filter((t) => t.language === pref.subtitleLang);

      if (pref.subtitleMode === "forced") {
        const forced = subs.find((t) => t.isForced);
        if (forced) subtitleIndex = forced.index;
      } else if (pref.subtitleMode === "signs") {
        const signs = subs.find((t) =>
          t.title?.toLowerCase().includes("sign") ||
          t.title?.toLowerCase().includes("songs")
        );
        if (signs) subtitleIndex = signs.index;
        else {
          const forced = subs.find((t) => t.isForced);
          if (forced) subtitleIndex = forced.index;
        }
      } else if (pref.subtitleMode === "always") {
        subtitleIndex = subs[0]?.index ?? null;
      }
    }

    return { audioIndex, subtitleIndex };
  });
};
