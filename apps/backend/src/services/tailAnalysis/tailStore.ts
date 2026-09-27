/**
 * Où l'analyse de fin de média RANGE ce qu'elle a trouvé — et seulement ça.
 *
 * La table est celle de l'ancienne analyse des vignettes (`media_frame_analysis`),
 * dont ce verdict prend la suite : même clé (l'item), même témoin du fichier (la
 * durée à une seconde près), une version qui périme les lignes d'avant.
 *
 * # Rien n'est rangé quand rien n'est trouvé
 *
 * Un média dont l'analyse ne conclut rien n'écrit PAS de ligne : il ne pèse pas
 * sur le serveur. Le prix est de le réanalyser un jour plus tard — un
 * refroidissement en mémoire (`tailAnalysis.ts`) évite de le refaire à chaque
 * lecture en attendant. Les lignes « rien » de l'ancienne analyse, et celles des
 * versions périmées, sont purgées au démarrage.
 */

import type { TailVerdict } from "../../playback/tailVerdict";
import { getPrisma, hasPrisma } from "../db";

/**
 * Monter ce numéro périme toutes les lignes. Il prend la suite de
 * `FRAME_ANALYSIS_VERSION` (1 à 4, l'analyse des vignettes seules) :
 * v5 : analyse de fin de média, vignettes classées et audio ;
 * v6 : générique illustré, aperçu du prochain épisode, logos de fin, marqueurs
 *      démentis — le verdict porte `preview` et `overrides`.
 */
export const TAIL_ANALYSIS_VERSION = 6;

/** La durée est le témoin du FICHIER : une durée différente, un autre fichier. */
const RUNTIME_TOLERANCE_MS = 1_000;

function parse(raw: string): TailVerdict | null {
  try {
    const v = JSON.parse(raw) as Partial<TailVerdict>;
    if (typeof v.creditsStartMs !== "number" || !Array.isArray(v.scenes)) return null;
    return {
      creditsStartMs: v.creditsStartMs,
      scenes: v.scenes.filter((s) => typeof s?.startMs === "number" && typeof s?.endMs === "number"),
      crawl: Array.isArray(v.crawl) && v.crawl.length === 2 ? [v.crawl[0], v.crawl[1]] : null,
      audio: v.audio === true,
      ...(Array.isArray(v.preview) && v.preview.length === 2 ? { preview: [v.preview[0], v.preview[1]] as [number, number] } : {}),
      ...(v.overrides === true ? { overrides: true } : {}),
    };
  } catch {
    return null;
  }
}

/** Le verdict rangé, ou `undefined` : jamais analysé, rien trouvé, ou ligne périmée. */
export async function readTailVerdict(itemId: string, runtimeMs: number): Promise<TailVerdict | undefined> {
  if (!hasPrisma() || runtimeMs <= 0) return undefined;
  try {
    const row = await getPrisma().mediaFrameAnalysis.findUnique({ where: { itemId } });
    if (!row || row.version !== TAIL_ANALYSIS_VERSION || row.verdict === null) return undefined;
    if (Math.abs(row.runtimeMs - runtimeMs) > RUNTIME_TOLERANCE_MS) return undefined;
    return parse(row.verdict) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function storeTailVerdict(itemId: string, runtimeMs: number, verdict: TailVerdict): Promise<void> {
  if (!hasPrisma()) return;
  const row = { version: TAIL_ANALYSIS_VERSION, runtimeMs, verdict: JSON.stringify(verdict), createdAt: new Date() };
  try {
    await getPrisma().mediaFrameAnalysis.upsert({ where: { itemId }, update: row, create: { itemId, ...row } });
  } catch (error) {
    // Une base indisponible ne fait pas tomber une analyse qui, elle, a abouti :
    // elle sera refaite au prochain lancement.
    console.warn(`[fin] ${itemId} : verdict non enregistré (${String(error)})`);
  }
}

/** Les lignes « rien trouvé » et les versions périmées — au démarrage. */
export async function purgeObsoleteTailRows(): Promise<number> {
  if (!hasPrisma()) return 0;
  try {
    const { count } = await getPrisma().mediaFrameAnalysis.deleteMany({
      where: { OR: [{ verdict: null }, { version: { not: TAIL_ANALYSIS_VERSION } }] },
    });
    if (count > 0) console.info(`[fin] purge : ${String(count)} analyses sans résultat ou périmées`);
    return count;
  } catch (error) {
    console.warn(`[fin] purge échouée (${String(error)})`);
    return 0;
  }
}
