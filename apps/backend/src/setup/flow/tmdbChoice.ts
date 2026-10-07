import type { FastifyBaseLogger } from "fastify";
import { deleteConfigValue, getConfigValue, setConfigValue } from "../../services/configStore";
import { getTmdbApiKey } from "../../services/tmdb/client";
import { dismissAccountHint } from "../../routes/preferences.hints";
import type { SetupTmdbState } from "../setupFlowContract";
import { SETUP_KEYS } from "../setupStore";

/**
 * La clé TMDB dans l'assistant : la même clé que l'administration
 * (`tmdb_api_key`, la variable `TMDB_API_KEY` restant prioritaire), et le
 * choix « Configurer plus tard », gardé jusqu'à la fin de l'installation.
 *
 * « Plus tard » ne se traduit qu'à `/complete`, quand le compte administrateur
 * est connu : l'avis « Aucune clé TMDB » (`tmdbKey`) y est masqué pour lui,
 * comme son « Ne plus afficher ». La recommandation du tableau de bord
 * (`adminTmdbKey`, un autre rappel) reste : c'est là qu'il la retrouve.
 */

/** Ce que l'écran doit savoir — jamais la clé, au plus ses quatre derniers caractères. */
export function tmdbSetupState(): SetupTmdbState {
  const env = process.env.TMDB_API_KEY;
  const key = getTmdbApiKey();
  return {
    configured: !!key,
    source: env ? "env" : key ? "db" : null,
    last4: key ? key.slice(-4) : null,
    later: getConfigValue(SETUP_KEYS.tmdbLater) === "1",
  };
}

/** Une clé validée par TMDB : enregistrée, et le « plus tard » d'avant oublié. */
export async function saveSetupTmdbKey(key: string): Promise<void> {
  await setConfigValue("tmdb_api_key", key);
  await deleteConfigValue(SETUP_KEYS.tmdbLater);
}

export async function rememberTmdbLater(): Promise<void> {
  await setConfigValue(SETUP_KEYS.tmdbLater, "1");
}

/**
 * À la fin : « plus tard » choisi ET toujours aucune clé → l'avis est masqué
 * pour l'administrateur. Une clé en place (saisie après, ou par
 * l'environnement) : rien à masquer. Jamais bloquant pour l'installation.
 */
export async function settleTmdbChoice(adminUserId: string, log: FastifyBaseLogger): Promise<void> {
  if (getConfigValue(SETUP_KEYS.tmdbLater) !== "1") return;
  try {
    if (!getTmdbApiKey()) {
      await dismissAccountHint(adminUserId, "tmdbKey");
      log.info("[Setup] clé TMDB à poser plus tard : l'avis « Aucune clé TMDB » est masqué pour l'administrateur");
    }
    await deleteConfigValue(SETUP_KEYS.tmdbLater);
  } catch (err) {
    log.warn({ err: { message: err instanceof Error ? err.message : String(err) } }, "[Setup] avis TMDB non masqué");
  }
}
