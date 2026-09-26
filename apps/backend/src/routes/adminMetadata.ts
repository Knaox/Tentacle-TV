/**
 * Configuration des services de métadonnées (TMDB, région des plateformes) —
 * les clés vivent dans server_config (configStore) ; une variable
 * d'environnement, quand elle existe, garde la PRIORITÉ (cf. tmdb/client.ts —
 * l'UI l'affiche pour ne pas troubler). Lecture MASQUÉE : jamais une valeur en
 * clair dans une réponse — un booléen « configuré », la source, au plus quatre
 * caractères de la clé TMDB.
 */

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth";
import { deleteConfigValue, getConfigValue, setConfigValue } from "../services/configStore";
import { fanoutStatus, kickRecoFanout } from "../services/reco/fanout";
import { refreshTrending } from "../services/reco/trendingRow";
import { requestCrawlerReseed } from "../services/reco/crawlReseed";
import { getTmdbApiKey } from "../services/tmdb/client";
import { checkTmdbKey } from "../services/tmdb/keyCheck";
import { getProviderRegions, getWatchProviderDirectory } from "../services/tmdb/providerDirectory";

/** ISO 3166-1 alpha-2 — la seule forme que le réglage de région accepte. */
const REGION_CODE = /^[A-Z]{2}$/;

const putSchema = z.object({
  tmdbApiKey: z.string().max(128).optional(),
  /** Région watch-providers (ISO 3166-1 alpha-2), consommée par metaCache. */
  watchRegion: z.string().regex(REGION_CODE).optional(),
});

const testSchema = z.object({
  /** Absente : c'est la clé EFFECTIVE du serveur (variable d'environnement
   *  comprise) qui passe le test. */
  tmdbApiKey: z.string().max(128).optional(),
});

/** Champ présent + non vide → écrit ; chaîne vide → supprimé ; absent → intact. */
async function applyField(key: string, value: string | undefined): Promise<void> {
  if (value === undefined) return;
  const trimmed = value.trim();
  if (trimmed) await setConfigValue(key, trimmed);
  else await deleteConfigValue(key);
}

export const adminMetadataRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAdmin);

  app.get("/metadata", async () => {
    const envTmdb = process.env.TMDB_API_KEY;
    const dbTmdb = getConfigValue("tmdb_api_key");
    const tmdbKey = envTmdb || dbTmdb;
    return {
      tmdb: {
        configured: !!tmdbKey,
        source: envTmdb ? "env" : dbTmdb ? "db" : null,
        last4: tmdbKey ? tmdbKey.slice(-4) : null,
      },
      watchRegion: getConfigValue("tmdb_watch_region") || "FR",
      // L'UI peut dire « calcul des recommandations en cours (3/12) ».
      fanout: fanoutStatus(),
    };
  });

  app.put("/metadata", async (request, reply) => {
    const body = putSchema.parse(request.body);
    // Une clé TMDB se VALIDE avant d'être acceptée — refusée ou invérifiable,
    // elle n'est pas stockée (l'admin le sait tout de suite, pas au prochain
    // pool vide). Les deux refus se distinguent : l'un appelle une autre clé,
    // l'autre un nouvel essai.
    const candidate = body.tmdbApiKey?.trim();
    if (candidate) {
      const verdict = await checkTmdbKey(candidate);
      if (verdict === "invalid") return reply.status(400).send({ error: "tmdb-key-invalid" });
      if (verdict === "unreachable") return reply.status(502).send({ error: "tmdb-unreachable" });
    }
    // La clé TMDB EST l'interrupteur des recommandations : sa pose (ou son
    // changement) déclenche les tendances puis le calcul pour tous les
    // comptes. Comparaison sur la clé EFFECTIVE : une variable d'environnement
    // prioritaire rend l'écriture DB inerte — rien ne se déclenche.
    const beforeKey = getTmdbApiKey();
    const beforeRegion = getConfigValue("tmdb_watch_region") || "FR";
    await applyField("tmdb_api_key", body.tmdbApiKey);
    await applyField("tmdb_watch_region", body.watchRegion);
    const afterKey = getTmdbApiKey();
    if (afterKey && afterKey !== beforeKey) {
      void refreshTrending().catch(() => undefined);
      kickRecoFanout({ force: true, reason: "key-set" });
    }
    // Les plateformes des pools sont celles de l'ancienne région : le crawler
    // les réapprend (cache d'abord, le payload brut porte toutes les régions).
    if ((getConfigValue("tmdb_watch_region") || "FR") !== beforeRegion) {
      requestCrawlerReseed("region");
    }
    return { ok: true };
  });

  /**
   * POST /api/admin/metadata/tmdb/test { tmdbApiKey? }
   *   → { result: "valid" | "invalid" | "unreachable" }
   * Le bouton « Tester » : une clé saisie, sans l'enregistrer, ou la clé en
   * place — révoquée depuis, ou serveur privé de réseau ? Rien n'est écrit.
   */
  app.post("/metadata/tmdb/test", async (request, reply) => {
    const body = testSchema.parse(request.body ?? {});
    const candidate = body.tmdbApiKey?.trim() || getTmdbApiKey();
    if (!candidate) return reply.status(400).send({ error: "tmdb-key-missing" });
    return { result: await checkTmdbKey(candidate) };
  });

  /**
   * GET /api/admin/metadata/regions → { regions: [{ code, providers }] }
   * Les pays où TMDB connaît des plateformes, lus dans l'annuaire mondial déjà
   * persisté — aucun appel TMDB. Vide sans clé ni copie : le client propose
   * alors tous les pays.
   */
  app.get("/metadata/regions", async () => ({ regions: await getProviderRegions() }));

  /**
   * GET /api/admin/metadata/regions/:code → { region, providers: [{ id, name, logoPath }] }
   * L'aperçu d'un pays AVANT de l'enregistrer : ses plateformes, dans l'ordre
   * d'affichage de TMDB. Même source, même absence d'appel.
   */
  app.get("/metadata/regions/:code", async (request, reply) => {
    const region = String((request.params as { code?: string }).code ?? "").toUpperCase();
    if (!REGION_CODE.test(region)) return reply.status(400).send({ error: "region-invalid" });
    const { providers } = await getWatchProviderDirectory(region);
    return { region, providers };
  });
};
