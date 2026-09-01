/**
 * Configuration des services de métadonnées (TMDB, AniList, région des
 * plateformes) — les clés vivent dans server_config (configStore) ; une
 * variable d'environnement, quand elle existe, garde la PRIORITÉ (cf.
 * tmdb/client.ts et anilist/oauth.ts — l'UI l'affiche pour ne pas troubler).
 * Lecture MASQUÉE : jamais une valeur en clair dans une réponse — un booléen
 * « configuré », la source, au plus quatre caractères de la clé TMDB, et
 * JAMAIS le moindre caractère du secret AniList.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { deleteConfigValue, getConfigValue, setConfigValue } from "../services/configStore";

const putSchema = z.object({
  tmdbApiKey: z.string().max(128).optional(),
  anilistClientId: z.string().max(128).optional(),
  anilistClientSecret: z.string().max(256).optional(),
  /** Région watch-providers (ISO 3166-1 alpha-2), consommée par metaCache. */
  watchRegion: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

/** Champ présent + non vide → écrit ; chaîne vide → supprimé ; absent → intact. */
async function applyField(key: string, value: string | undefined): Promise<void> {
  if (value === undefined) return;
  const trimmed = value.trim();
  if (trimmed) await setConfigValue(key, trimmed);
  else await deleteConfigValue(key);
}

/** La clé candidate répond-elle chez TMDB ? `/configuration` est l'appel le
 *  moins cher de l'API. Clé en query param — jamais en Bearer (cf. la
 *  doctrine de tmdb/client.ts) et jamais loggée. */
async function tmdbKeyValid(candidate: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(candidate)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export const adminMetadataRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  app.get("/metadata", async () => {
    const envTmdb = process.env.TMDB_API_KEY;
    const dbTmdb = getConfigValue("tmdb_api_key");
    const tmdbKey = envTmdb || dbTmdb;
    const envAnilistId = process.env.ANILIST_CLIENT_ID;
    const anilistId = envAnilistId || getConfigValue("anilist_client_id");
    const anilistSecret = process.env.ANILIST_CLIENT_SECRET || getConfigValue("anilist_client_secret");
    return {
      tmdb: {
        configured: !!tmdbKey,
        source: envTmdb ? "env" : dbTmdb ? "db" : null,
        last4: tmdbKey ? tmdbKey.slice(-4) : null,
      },
      anilist: {
        clientIdConfigured: !!anilistId,
        clientSecretConfigured: !!anilistSecret,
        source: envAnilistId ? "env" : anilistId ? "db" : null,
      },
      watchRegion: getConfigValue("tmdb_watch_region") || "FR",
    };
  });

  app.put("/metadata", async (request, reply) => {
    const body = putSchema.parse(request.body);
    // Une clé TMDB se VALIDE avant d'être acceptée — invalide = refusée, pas
    // stockée (l'admin le sait tout de suite, pas au prochain pool vide).
    const candidate = body.tmdbApiKey?.trim();
    if (candidate && !(await tmdbKeyValid(candidate))) {
      return reply.status(400).send({ error: "tmdb-key-invalid" });
    }
    await applyField("tmdb_api_key", body.tmdbApiKey);
    await applyField("anilist_client_id", body.anilistClientId);
    await applyField("anilist_client_secret", body.anilistClientSecret);
    await applyField("tmdb_watch_region", body.watchRegion);
    return { ok: true };
  });
};
