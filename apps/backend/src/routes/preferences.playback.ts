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
import type { JellyfinUser } from "../middleware/auth";
import {
  DEFAULT_PLAYBACK_SETTINGS,
  NEXT_BEFORE_END_SECONDS_MAX,
  NEXT_BEFORE_END_SECONDS_MIN,
  SEGMENT_AUTO_DELAY_MAX_MS,
  normalizePlaybackSettings,
  type PlaybackSettings,
} from "../playback/playbackSettings";

const segmentSchema = z.object({
  action: z.enum(["button", "auto", "off"]),
  countdownVisible: z.boolean(),
  autoDelayMs: z.number().int().min(0).max(SEGMENT_AUTO_DELAY_MAX_MS),
});

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
    nextBeforeEndSeconds: z
      .number()
      .int()
      .min(NEXT_BEFORE_END_SECONDS_MIN)
      .max(NEXT_BEFORE_END_SECONDS_MAX),
  }),
});

/** La ligne Prisma, à plat — le type suit le modèle `PlaybackSettings` du schéma. */
interface PlaybackSettingsRow {
  introAction: string;
  introCountdown: boolean;
  introDelayMs: number;
  outroAction: string;
  outroCountdown: boolean;
  outroDelayMs: number;
  recapAction: string;
  recapCountdown: boolean;
  recapDelayMs: number;
  previewAction: string;
  previewCountdown: boolean;
  previewDelayMs: number;
  nextCard: boolean;
  nextCountdown: boolean;
  nextAutoPlay: boolean;
  nextTrigger: string;
  nextBeforeEndSeconds: number;
}

/** Colonnes → objet imbriqué, passé par la normalisation (une colonne modifiée
 *  à la main en base retombe sur son défaut au lieu de casser un lecteur). */
function rowToSettings(row: PlaybackSettingsRow): PlaybackSettings {
  return normalizePlaybackSettings({
    intro: { action: row.introAction, countdownVisible: row.introCountdown, autoDelayMs: row.introDelayMs },
    outro: { action: row.outroAction, countdownVisible: row.outroCountdown, autoDelayMs: row.outroDelayMs },
    recap: { action: row.recapAction, countdownVisible: row.recapCountdown, autoDelayMs: row.recapDelayMs },
    preview: {
      action: row.previewAction,
      countdownVisible: row.previewCountdown,
      autoDelayMs: row.previewDelayMs,
    },
    next: {
      nextCard: row.nextCard,
      nextCountdown: row.nextCountdown,
      nextAutoPlay: row.nextAutoPlay,
      nextTrigger: row.nextTrigger,
      nextBeforeEndSeconds: row.nextBeforeEndSeconds,
    },
  });
}

function settingsToColumns(reglages: PlaybackSettings): PlaybackSettingsRow {
  return {
    introAction: reglages.intro.action,
    introCountdown: reglages.intro.countdownVisible,
    introDelayMs: reglages.intro.autoDelayMs,
    outroAction: reglages.outro.action,
    outroCountdown: reglages.outro.countdownVisible,
    outroDelayMs: reglages.outro.autoDelayMs,
    recapAction: reglages.recap.action,
    recapCountdown: reglages.recap.countdownVisible,
    recapDelayMs: reglages.recap.autoDelayMs,
    previewAction: reglages.preview.action,
    previewCountdown: reglages.preview.countdownVisible,
    previewDelayMs: reglages.preview.autoDelayMs,
    nextCard: reglages.next.nextCard,
    nextCountdown: reglages.next.nextCountdown,
    nextAutoPlay: reglages.next.nextAutoPlay,
    nextTrigger: reglages.next.nextTrigger,
    nextBeforeEndSeconds: reglages.next.nextBeforeEndSeconds,
  };
}

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
    const reglages = settingsSchema.parse(request.body);

    const colonnes = settingsToColumns(reglages);
    const row = await prisma.playbackSettings.upsert({
      where: { jellyfinUserId: user.userId },
      create: { jellyfinUserId: user.userId, ...colonnes },
      update: colonnes,
    });
    return { stored: true, settings: rowToSettings(row) };
  });
}
