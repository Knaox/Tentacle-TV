import { hasPrisma } from "../services/db";
import { getConfigValue, getDirectStreamingConfig, getPublicUrl, setConfigValue } from "../services/configStore";

/** La marque de la migration, dans `server_config` : posée, plus rien n'est touché. */
export const EXPOSURE_MIGRATION_KEY = "remote_access_switch_applied";
const ENABLED_KEY = "remote_access_enabled";

/**
 * « Accès depuis l'extérieur » gouverne désormais ce qui est publié. Un
 * serveur d'avant qui publiait déjà un lien (le sien, `public_url` ou
 * `TENTACLE_PUBLIC_URL`, ou l'adresse publique de la lecture directe) est
 * allumé UNE fois : pour lui, rien ne change. Un serveur neuf, ou qui ne
 * publiait rien, reste coupé — rien d'exposé par défaut.
 *
 * La marque n'est posée qu'APRÈS l'interrupteur (un échec entre les deux fait
 * seulement recommencer au démarrage suivant) ; posée, le choix de
 * l'administrateur est respecté pour toujours. Non bloquant.
 */
export async function applyExposureDefault(): Promise<"applied" | "already" | "skipped"> {
  if (!hasPrisma()) return "skipped";
  if (getConfigValue(EXPOSURE_MIGRATION_KEY) !== undefined) return "already";
  try {
    const direct = getDirectStreamingConfig();
    const published = !!getPublicUrl() || (direct.enabled && !!direct.publicUrl);
    if (published && getConfigValue(ENABLED_KEY) !== "true") {
      await setConfigValue(ENABLED_KEY, "true");
      console.log("[Accès à distance] « Accès depuis l'extérieur » allumé : ce serveur publiait déjà un lien public");
    }
    await setConfigValue(EXPOSURE_MIGRATION_KEY, new Date().toISOString());
    return "applied";
  } catch (err) {
    console.warn("[Accès à distance] Migration de l'interrupteur non appliquée :", (err as Error)?.message ?? err);
    return "skipped";
  }
}
