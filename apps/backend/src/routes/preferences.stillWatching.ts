/**
 * GET/PUT /api/preferences/still-watching — « Vous regardez encore ? », un
 * réglage du COMPTE (capacité `playback.stillWatching`) : réglé sur un
 * appareil, il vaut sur tous ; les autres l'apprennent en direct
 * (`preferences:update`, portée `still-watching`). Contrat :
 * `playback/stillWatchingSettings.ts` (miroir de shared).
 *
 * Rangé dans `server_config` sous `user_still_watching_<userId>`, comme les
 * rappels masqués : aucune table, aucun schéma à migrer. Jamais choisi =
 * aucune ligne = les défauts (activé). Une ligne illisible vaut les défauts.
 *
 * Enregistré depuis `preferences.ts` : le hook `requireAuth` du plugin s'applique.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrisma } from "../services/db";
import type { JellyfinUser } from "../middleware/auth";
import {
  DEFAULT_STILL_WATCHING_SETTINGS,
  normalizeStillWatchingSettings,
  type StillWatchingSettingsResponse,
} from "../playback/stillWatchingSettings";
import { notifyPreferencesUpdate } from "./preferences.notify";

const bodySchema = z.object({
  enabled: z.boolean(),
  afterMs: z.number().int().positive(),
  countdownMs: z.number().int().positive(),
});

export function stillWatchingConfigKey(userId: string): string {
  return `user_still_watching_${userId}`;
}

async function readSettings(userId: string): Promise<StillWatchingSettingsResponse> {
  const row = await getPrisma().serverConfig.findUnique({ where: { key: stillWatchingConfigKey(userId) } });
  if (!row) return { stored: false, settings: { ...DEFAULT_STILL_WATCHING_SETTINGS } };
  try {
    return { stored: true, settings: normalizeStillWatchingSettings(JSON.parse(row.value)) };
  } catch {
    return { stored: false, settings: { ...DEFAULT_STILL_WATCHING_SETTINGS } };
  }
}

export function registerStillWatchingRoutes(app: FastifyInstance): void {
  app.get("/still-watching", async (request): Promise<StillWatchingSettingsResponse> => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    return readSettings(user.userId);
  });

  app.put("/still-watching", async (request): Promise<StillWatchingSettingsResponse> => {
    const user = (request as unknown as { user: JellyfinUser }).user;
    const settings = normalizeStillWatchingSettings(bodySchema.parse(request.body));
    const key = stillWatchingConfigKey(user.userId);
    const value = JSON.stringify(settings);
    await getPrisma().serverConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
    notifyPreferencesUpdate(request, user.userId, "still-watching");
    return { stored: true, settings };
  });
}
