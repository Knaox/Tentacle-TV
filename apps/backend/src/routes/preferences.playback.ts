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
  BEFORE_END_MAX_RULES,
  DEFAULT_PLAYBACK_SETTINGS,
  NEXT_BEFORE_END_PERCENT_MAX,
  NEXT_BEFORE_END_PERCENT_MIN,
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
  beforeEndEnabled: boolean;
  beforeEndMode: string;
  beforeEndValue: number;
  /** JSON des règles ciblées. Null = aucune (colonne ajoutée après coup). */
  beforeEndRules: string | null;
}

/** Les règles, relues sans faire confiance : un JSON illisible vaut « aucune ». */
function parseRules(raw: string | null): unknown {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
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
      // `nextBeforeEndSeconds` reste lu pour les lignes d'avant : la
      // normalisation le convertit en seuil quand aucun n'est enregistré.
      nextBeforeEndSeconds: row.nextBeforeEndSeconds,
      beforeEndEnabled: row.beforeEndEnabled,
      beforeEndDefault: { mode: row.beforeEndMode, value: row.beforeEndValue },
      beforeEndRules: parseRules(row.beforeEndRules),
    },
  });
}

function settingsToColumns(settings: PlaybackSettings): PlaybackSettingsRow {
  return {
    introAction: settings.intro.action,
    introCountdown: settings.intro.countdownVisible,
    introDelayMs: settings.intro.autoDelayMs,
    outroAction: settings.outro.action,
    outroCountdown: settings.outro.countdownVisible,
    outroDelayMs: settings.outro.autoDelayMs,
    recapAction: settings.recap.action,
    recapCountdown: settings.recap.countdownVisible,
    recapDelayMs: settings.recap.autoDelayMs,
    previewAction: settings.preview.action,
    previewCountdown: settings.preview.countdownVisible,
    previewDelayMs: settings.preview.autoDelayMs,
    nextCard: settings.next.nextCard,
    nextCountdown: settings.next.nextCountdown,
    nextAutoPlay: settings.next.nextAutoPlay,
    nextTrigger: settings.next.nextTrigger,
    // Colonne héritée, plus lue par le contrat : on y recopie le seuil quand
    // il est en secondes, pour qu'un serveur d'avant reste cohérent.
    nextBeforeEndSeconds:
      settings.next.beforeEndDefault.mode === "seconds"
        ? settings.next.beforeEndDefault.value
        : 45,
    beforeEndEnabled: settings.next.beforeEndEnabled,
    beforeEndMode: settings.next.beforeEndDefault.mode,
    beforeEndValue: settings.next.beforeEndDefault.value,
    beforeEndRules: JSON.stringify(settings.next.beforeEndRules),
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
