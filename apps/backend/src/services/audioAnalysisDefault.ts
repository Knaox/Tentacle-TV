import { hasPrisma } from "./db";
import { AUDIO_ANALYSIS_KEY, getConfigValue, setConfigValue } from "./configStore";

/** La marque de la migration, dans `server_config` : posée, plus rien n'est touché. */
export const AUDIO_DEFAULT_MIGRATION_KEY = "audio_analysis_default_off_applied";

/**
 * L'analyse audio des passages coupée UNE fois sur les serveurs d'avant le
 * 2026-10-06, où elle tournait d'office (clé absente = « oui »).
 *
 * La marque n'est posée qu'APRÈS l'interrupteur : un échec entre les deux fait
 * seulement recouper au démarrage suivant, avant que quiconque ait pu choisir.
 * Une fois posée, un administrateur qui rallume l'analyse est respecté pour
 * toujours. Un serveur neuf passe aussi par ici — la clé absente y vaut déjà
 * « non ». Non bloquant : un échec laisse le démarrage suivant retenter.
 */
export async function applyAudioAnalysisDefault(): Promise<"applied" | "already" | "skipped"> {
  if (!hasPrisma()) return "skipped";
  if (getConfigValue(AUDIO_DEFAULT_MIGRATION_KEY) !== undefined) return "already";
  try {
    const wasOn = getConfigValue(AUDIO_ANALYSIS_KEY) !== "false";
    await setConfigValue(AUDIO_ANALYSIS_KEY, "false");
    await setConfigValue(AUDIO_DEFAULT_MIGRATION_KEY, new Date().toISOString());
    if (wasOn) console.log("[Passages] Analyse audio coupée (nouveau réglage par défaut) — l'administrateur peut la rallumer dans Services");
    return "applied";
  } catch (err) {
    console.warn("[Passages] Analyse audio : migration non appliquée :", (err as Error)?.message ?? err);
    return "skipped";
  }
}
