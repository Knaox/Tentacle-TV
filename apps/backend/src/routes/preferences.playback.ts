/**
 * GET/PUT /api/preferences/playback — les réglages de lecture du compte
 * (segments et enchaînement d'épisode), partagés entre tous ses appareils.
 *
 * GET rend `{ stored, settings }` : `stored: false` = aucune ligne en base,
 * jamais un 404 — c'est le signal qui autorise un client à SEMER une seule
 * fois depuis ses anciennes clés d'appareil (migration douce). Les défauts et
 * la normalisation viennent du miroir `src/playback/playbackSettings.ts`
 * (copie stricte de @tentacle-tv/shared).
 *
 * Enregistré depuis `preferences.ts` (même motif que `registerResolveRoute`) :
 * le hook `requireAuth` du plugin s'applique.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import { rowToSettings, settingsToColumns } from "../services/playbackSettingsService";
import type { JellyfinUser } from "../middleware/auth";
import {
  BEFORE_END_MAX_RULES,
  DEFAULT_PLAYBACK_SETTINGS,
  NEXT_BEFORE_END_PERCENT_MAX,
  NEXT_BEFORE_END_PERCENT_MIN,
  NEXT_BEFORE_END_SECONDS_MAX,
  NEXT_BEFORE_END_SECONDS_MIN,
  SEGMENT_AUTO_DELAY_MAX_MS,
} from "../playback/playbackSettings";

const segmentSchema = z.object({
  action: z.enum(["button", "auto", "off"]),
  countdownVisible: z.boolean(),
  autoDelayMs: z.number().int().min(0).max(SEGMENT_AUTO_DELAY_MAX_MS),
});

/** Un seuil : une proportion, ou des secondes — chacun dans ses bornes. */
const beforeEndTargetSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("percent"),
    value: z.number().int().min(NEXT_BEFORE_END_PERCENT_MIN).max(NEXT_BEFORE_END_PERCENT_MAX),
  }),
  z.object({
    mode: z.literal("seconds"),
    value: z.number().int().min(NEXT_BEFORE_END_SECONDS_MIN).max(NEXT_BEFORE_END_SECONDS_MAX),
  }),
]);

const settingsSchema = z.object({
  intro: segmentSchema,
  outro: segmentSchema,
  recap: segmentSchema,
  preview: segmentSchema,
  next: z.object({
    nextCard: z.boolean(),
    nextCountdown: z.boolean(),
    nextAutoPlay: z.boolean(),
    nextTrigger: z.enum(["outroStart", "beforeEnd"]),
    beforeEndEnabled: z.boolean(),
    beforeEndDefault: beforeEndTargetSchema,
    // Bornée : la liste vient d'un formulaire, pas d'un import. Sans plafond,
    // une colonne TEXT accepterait n'importe quel volume.
    beforeEndRules: z
      .array(
        z.intersection(
          beforeEndTargetSchema,
          z.object({ libraryIds: z.array(z.string().min(1).max(64)).min(1).max(64) }),
        ),
      )
      .max(BEFORE_END_MAX_RULES),
  }),
});

export function registerPlaybackSettingsRoutes(app: FastifyInstance): void {
  app.get("/playback", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;

    const row = await prisma.playbackSettings.findUnique({
      where: { jellyfinUserId: user.userId },
    });
    if (!row) return { stored: false, settings: DEFAULT_PLAYBACK_SETTINGS };
    return { stored: true, settings: rowToSettings(row) };
  });

  app.put("/playback", async (request) => {
    const prisma = getPrisma();
    const user = (request as any).user as JellyfinUser;
    const settings = settingsSchema.parse(request.body);

    const columns = settingsToColumns(settings);
    const row = await prisma.playbackSettings.upsert({
      where: { jellyfinUserId: user.userId },
      create: { jellyfinUserId: user.userId, ...columns },
      update: columns,
    });
    return { stored: true, settings: rowToSettings(row) };
  });
}
