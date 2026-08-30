/**
 * L'analyse des vignettes : quand la lancer, où ranger sa réponse.
 *
 * Trois règles, et elles viennent toutes de la même demande — **ne pas gêner
 * les médias que Jellyfin détecte bien** :
 *
 *  1. on n'analyse QUE sur demande, au lancement d'un média. Un film jamais
 *     regardé n'est jamais analysé : aucune passe de fond, aucune file ;
 *  2. on n'analyse que si le résolveur, sans nous, n'a rien de crédible à dire
 *     sur le générique de fin — absent, ou courant jusqu'au bout du fichier ;
 *  3. le lecteur n'attend JAMAIS. La route répond avec ce qu'elle sait et pose
 *     `analysisPending` ; le résultat sert à la fin du média, deux heures plus
 *     tard.
 *
 * Le résultat est rangé en base, `null` compris — sans quoi un média dont
 * l'analyse ne conclut rien serait réanalysé à chaque lecture.
 */

import type { FrameVerdict } from "../playback/creditsFromFrames";
import { creditsFromFrames } from "../playback/creditsFromFrames";
import type { PlaybackSegmentsResponse } from "../playback/segmentTypes";
import { getPrisma, hasPrisma } from "./db";
import { collectFrameSamples, type TrickplayManifest } from "./trickplayFrames";

/**
 * Monter ce numéro périme toutes les lignes en base sans avoir à les effacer.
 * À faire dès que les seuils ou la règle de `creditsFromFrames.ts` changent.
 *
 * v2 : la borne de saut recule d'une vignette — les verdicts v1 envoyaient le
 * spectateur jusqu'à dix secondes APRÈS le début de la scène.
 * v3 : SATURATION_MAX 18 → 28 — les cartes de crédits illustrées sombres
 * (« Brave New World ») rejoignent le générique.
 */
export const FRAME_ANALYSIS_VERSION = 3;

/** Ce qu'on a en base : le verdict, ou l'absence de verdict ASSUMÉE. */
type Stored = { verdict: FrameVerdict | null };

/** Les analyses en vol, pour ne pas en lancer deux sur le même média. */
const inFlight = new Set<string>();

function parseStored(row: { version: number; runtimeMs: number; verdict: string | null },
  runtimeMs: number): Stored | null {
  if (row.version !== FRAME_ANALYSIS_VERSION) return null;
  // La durée est le témoin du FICHIER : une durée différente, un autre fichier.
  if (Math.abs(row.runtimeMs - runtimeMs) > 1_000) return null;
  if (row.verdict === null) return { verdict: null };
  try {
    return { verdict: JSON.parse(row.verdict) as FrameVerdict };
  } catch {
    return null;
  }
}

/** Le verdict connu, ou `undefined` quand ce média n'a jamais été analysé. */
export async function readFrameVerdict(
  itemId: string,
  runtimeMs: number,
): Promise<FrameVerdict | null | undefined> {
  if (!hasPrisma() || runtimeMs <= 0) return undefined;
  try {
    const row = await getPrisma().mediaFrameAnalysis.findUnique({ where: { itemId } });
    if (!row) return undefined;
    const stored = parseStored(row, runtimeMs);
    return stored === null ? undefined : stored.verdict;
  } catch {
    return undefined;
  }
}

/**
 * Le résolveur a-t-il besoin d'aide sur ce média ?
 *
 * Un générique crédible qui ne court PAS jusqu'à la fin du fichier veut dire
 * qu'un chapitre nommé ou un greffon a fait le travail : on ne regarde rien.
 */
export function needsFrameAnalysis(resolved: PlaybackSegmentsResponse): boolean {
  if (resolved.runtimeMs <= 0) return false;
  const outros = resolved.segments.filter((s) => s.type === "Outro");
  if (outros.length === 0) return true;
  return outros.every((s) => s.endsAtMediaEnd);
}

export interface AnalysisRequest {
  itemId: string;
  runtimeMs: number;
  manifest: TrickplayManifest | null | undefined;
  mediaSourceId?: string;
  jellyfinUrl: string;
  apiKey: string;
}

async function store(itemId: string, runtimeMs: number, verdict: FrameVerdict | null): Promise<void> {
  if (!hasPrisma()) return;
  const row = {
    version: FRAME_ANALYSIS_VERSION,
    runtimeMs,
    verdict: verdict === null ? null : JSON.stringify(verdict),
  };
  try {
    await getPrisma().mediaFrameAnalysis.upsert({
      where: { itemId },
      update: row,
      create: { itemId, ...row },
    });
  } catch (error) {
    // Une base indisponible ne doit pas faire tomber une analyse qui, elle, a
    // abouti — elle sera simplement refaite au prochain lancement.
    console.warn(`[segments] ${itemId} : verdict non enregistré (${String(error)})`);
  }
}

/**
 * Lance l'analyse en arrière-plan. Rend la main tout de suite.
 *
 * Une seule par média à la fois : la route est appelée par chaque appareil qui
 * ouvre le même film, et trois analyses simultanées liraient trois fois les
 * mêmes planches.
 */
export function startFrameAnalysis(request: AnalysisRequest): void {
  if (inFlight.has(request.itemId)) return;
  inFlight.add(request.itemId);
  void (async () => {
    try {
      const { samples, intervalMs } = await collectFrameSamples(request);
      const verdict =
        samples.length === 0
          ? null
          : creditsFromFrames(samples, request.runtimeMs, intervalMs > 0 ? intervalMs : undefined);
      await store(request.itemId, request.runtimeMs, verdict);
      console.info(
        `[segments] ${request.itemId} : ${String(samples.length)} vignettes analysées — ` +
          (verdict
            ? `générique ${String(Math.round(verdict.outro.startMs / 1000))}s → ` +
              `${String(Math.round(verdict.outro.endMs / 1000))}s` +
              `${verdict.sceneAfter ? ", scène après" : ""}`
            : "aucun verdict"),
      );
    } catch (error) {
      console.warn(`[segments] ${request.itemId} : analyse abandonnée (${String(error)})`);
    } finally {
      inFlight.delete(request.itemId);
    }
  })();
}

/** Une analyse tourne-t-elle pour ce média ? (pour `analysisPending`) */
export function frameAnalysisRunning(itemId: string): boolean {
  return inFlight.has(itemId);
}
