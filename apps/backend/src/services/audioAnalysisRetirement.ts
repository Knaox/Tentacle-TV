import { readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { hasPrisma } from "./db";
import { deleteConfigValue, getConfigValue } from "./configStore";

/**
 * Le retrait de l'analyse audio de Tentacle (voisins de saison, écoute de la
 * fin de média) : ce qu'un serveur d'avant en garde, effacé UNE fois au
 * démarrage.
 *
 * Plus rien ne lit ces clés : un serveur qui l'avait allumée l'a perdue avec le
 * code, sans geste de l'administrateur. On les efface pour qu'il n'en reste
 * rien, et le journal le dit quand elle était allumée. Leur absence est la
 * marque : un serveur neuf, ou déjà nettoyé, ne fait rien. La migration des
 * vieux serveurs MariaDB peut encore les apporter : elles partent au démarrage
 * suivant, de la même façon. Non bloquant : un échec laisse le démarrage
 * suivant retenter.
 */

/** L'interrupteur d'avant (`"true"` = allumée) — clé de `server_config`, jamais renommée. */
export const RETIRED_AUDIO_SWITCH_KEY = "audio_analysis_enabled";
/** La marque de la coupure par défaut du 2026-10-06. */
export const RETIRED_AUDIO_DEFAULT_KEY = "audio_analysis_default_off_applied";
/** Le préfixe des dossiers temporaires des extraits audio. */
export const RETIRED_AUDIO_TEMP_PREFIX = "tentacle-audio-";

export async function retireAudioAnalysis(base = tmpdir()): Promise<"retired" | "nothing" | "skipped"> {
  if (!hasPrisma()) return "skipped";
  const switchValue = getConfigValue(RETIRED_AUDIO_SWITCH_KEY);
  const marker = getConfigValue(RETIRED_AUDIO_DEFAULT_KEY);
  if (switchValue === undefined && marker === undefined) return "nothing";
  try {
    // Les extraits d'une analyse interrompue par l'arrêt d'avant : plus rien ne les balaiera.
    await sweepAudioTempDirs(base);
    if (switchValue !== undefined) await deleteConfigValue(RETIRED_AUDIO_SWITCH_KEY);
    if (marker !== undefined) await deleteConfigValue(RETIRED_AUDIO_DEFAULT_KEY);
    if (switchValue === "true") {
      console.log("[Passages] Analyse audio de Tentacle retirée : elle était allumée sur ce serveur, elle s'arrête — rien à faire");
    }
    return "retired";
  } catch (err) {
    console.warn("[Passages] Retrait de l'analyse audio : réglages d'avant non effacés :", (err as Error)?.message ?? err);
    return "skipped";
  }
}

async function sweepAudioTempDirs(base: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(base);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith(RETIRED_AUDIO_TEMP_PREFIX)) continue;
    await rm(join(base, name), { recursive: true, force: true }).catch(() => undefined);
  }
}
