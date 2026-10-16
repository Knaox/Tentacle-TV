/* ------------------------------------------------------------------ */
/*  La préparation des aperçus des titres à l'écran                    */
/*                                                                     */
/*  Le client dit les titres que ses cartes montrent                   */
/*  (`POST /api/trailers/preview/warm`) ; leur aperçu se prépare EN    */
/*  FOND, trois à la fois, les derniers vus d'abord : le catalogue     */
/*  (TMDB par sa file de fond, AlloCiné à la cadence de préparation de */
/*  Dailymotion), puis la PREMIÈRE vidéo du catalogue — résolue si     */
/*  c'est une bande-annonce AlloCiné, préparée si c'est une vidéo      */
/*  YouTube que le relais tient déjà. Jamais d'extraction YouTube : une*/
/*  première vidéo YouTube à extraire attend le survol (« différé »),  */
/*  comme un catalogue dont une source n'a pas répondu, ou une première*/
/*  vidéo qui ne se lit pas. La décision prise en fond est donc        */
/*  toujours celle que le survol aurait prise ; il la trouve, et la    */
/*  vidéo part aussitôt.                                               */
/* ------------------------------------------------------------------ */

import type { TrailerVersion } from "../../../trailers/trailerCatalog";
import { buildCatalogDetailed } from "../catalog/catalogBuild";
import { resolveCatalogTitle } from "../catalog/catalogTitle";
import type { ResolvedTrailer } from "../trailerRelay";
import { holdsSource, peekTrailer } from "../trailerPrepare";
import { parseVideoRef } from "../videoRef";
import { attemptsOf, langRankOf, previewCandidates } from "./previewCandidates";
import { decisionInFlight } from "./previewDecision";
import { knownDecision, rememberRefusal } from "./previewDecisionMemory";
import { found, guardStop, heardVersion, newStages, playable, type PreviewTarget } from "./previewSteps";
import { TtlLru } from "./ttlLru";

/** Un titre à préparer : sa clé de décision (`decisionKey`), sa cible, la langue, le compte qui le voit. */
export interface WarmJob {
  key: string;
  target: PreviewTarget;
  lang: string | undefined;
  account: string;
  dailymotion: boolean;
}

/**
 * `decided` : la décision est prise (ou une refusée « aucune bande-annonce ») ;
 * `known` : elle l'était déjà, vidéo prête ; `deferred` : la première vidéo
 * demande une extraction YouTube — au survol ; `unanswered` : une source
 * muette, une vidéo qui ne se lit pas ; `hidden` : un titre que CE compte ne
 * voit pas — rien n'est retenu, un autre compte le préparera.
 */
export type WarmOutcome = "decided" | "known" | "deferred" | "unanswered" | "hidden";

/**
 * Trois préparations à la fois : du réseau (TMDB, Dailymotion) que leurs
 * cadences bornent, jamais un processus de plus — un écran de titres neufs se
 * prépare en une demi-minute environ, ses premiers en deux ou trois secondes.
 */
const CONCURRENCY = 3;
/** Les titres en attente, au plus : au-delà, les plus anciens vus sont oubliés. */
const MAX_QUEUE = 200;
/** Le catalogue en fond a le temps : ses sources attendent leur tour, personne n'attend la réponse. */
const WARM_CATALOG_BUDGET_MS = 30_000;
/** Différé (une extraction YouTube attend le survol) : pas de nouvel essai avant ce délai. */
const DEFERRED_MS = 10 * 60_000;
/** Une source muette, une vidéo qui ne se lit pas : un nouvel essai plus tard. */
const UNANSWERED_MS = 60_000;

const queue = new Map<string, WarmJob>();
const running = new Set<string>();
const resting = new TtlLru<WarmOutcome>(2_000);

/** La vidéo retenue d'un aperçu DÉJÀ prêt (décision connue, relais prêt) — sans rien demander à personne. */
export function readyPreview(key: string): { ref: string; resolved: ResolvedTrailer; version?: TrailerVersion } | null {
  const known = knownDecision(key);
  if (known?.kind !== "found") return null;
  const resolved = peekTrailer(known.ref);
  if (!resolved) return null;
  return known.version ? { ref: known.ref, resolved, version: known.version } : { ref: known.ref, resolved };
}

/** Une décision connue dont la vidéo n'est plus prête (un redémarrage, une URL échue) : relue si ça ne coûte rien à YouTube. */
async function warmKnown(job: WarmJob, ref: string, version: TrailerVersion | undefined, started: number): Promise<WarmOutcome> {
  const youtube = parseVideoRef(ref)?.kind !== "dailymotion";
  if (youtube && (!holdsSource(ref) || guardStop())) return "deferred";
  const stages = newStages();
  const resolved = await playable(ref, stages, { priority: "preview", background: true, heldOnly: youtube, startWarm: false });
  if (!resolved) return youtube ? "deferred" : "unanswered";
  found(job.key, ref, resolved, started, "préparé en fond (reprise)", stages, { version });
  return "decided";
}

/** Prépare l'aperçu de `job` (cf. l'en-tête) ; ne lance jamais d'extraction YouTube. */
export async function warmDecision(job: WarmJob): Promise<WarmOutcome> {
  const started = Date.now();
  const known = knownDecision(job.key);
  if (known?.kind === "refused") return "known";
  if (known?.kind === "found") return peekTrailer(known.ref) ? "known" : warmKnown(job, known.ref, known.version, started);
  // Un titre que CE compte ne voit pas ne se décide pas pour les autres.
  if ("itemId" in job.target.catalog && (await resolveCatalogTitle(job.target.catalog.itemId, job.account)).kind !== "title") return "hidden";
  const stages = newStages();
  const { response: catalog, answered } = await buildCatalogDetailed(job.target.catalog, job.account, WARM_CATALOG_BUDGET_MS, { priority: "background" });
  stages.catalog = Date.now() - started;
  if (!answered) return "unanswered";
  let candidates = previewCandidates(catalog.entries, { dailymotion: job.dailymotion });
  if (candidates.length === 0) {
    rememberRefusal(job.key, "no_trailer");
    return "decided";
  }
  // YouTube bride l'adresse : le survol n'essaierait que les vidéos Dailymotion.
  if (guardStop()) candidates = candidates.filter((candidate) => !candidate.youtube);
  const [first, ...others] = attemptsOf(candidates);
  if (!first || (first.youtube && !holdsSource(first.ref))) return "deferred";
  const resolved = await playable(first.ref, stages, { priority: "preview", background: true, heldOnly: first.youtube, startWarm: false });
  if (!resolved) return "unanswered";
  // La première ne parle pas la langue promise (doublage par IA retiré) : le survol essaiera les suivantes.
  const version = heardVersion(first.version, resolved, job.lang);
  if (langRankOf(version) > first.langRank && others.length > 0) return "deferred";
  found(job.key, first.ref, resolved, started, "préparé en fond", stages, { version });
  return "decided";
}

function pump(): void {
  while (running.size < CONCURRENCY && queue.size > 0) {
    const key = [...queue.keys()].pop() as string;
    const job = queue.get(key) as WarmJob;
    queue.delete(key);
    running.add(key);
    void warmDecision(job)
      .catch((): WarmOutcome => "unanswered")
      .then((outcome) => {
        if (outcome === "deferred") resting.set(key, outcome, DEFERRED_MS);
        else if (outcome === "unanswered") resting.set(key, outcome, UNANSWERED_MS);
      })
      .finally(() => {
        running.delete(key);
        pump();
      });
  }
}

/**
 * Met `jobs` en préparation — le PREMIER d'abord (le client les donne dans
 * l'ordre où ils comptent), devant tout ce qui attendait déjà. Rien pour un
 * titre déjà prêt, en cours de décision ou de préparation, ou au repos après
 * un essai récent. Rend le nombre de titres mis en préparation.
 */
export function warmPreviews(jobs: readonly WarmJob[]): number {
  let queued = 0;
  for (const job of [...jobs].reverse()) {
    if (running.has(job.key) || resting.get(job.key) !== undefined || decisionInFlight(job.key)) continue;
    const known = knownDecision(job.key);
    if (known?.kind === "refused" || (known?.kind === "found" && peekTrailer(known.ref))) continue;
    queue.delete(job.key);
    queue.set(job.key, job);
    queued++;
  }
  while (queue.size > MAX_QUEUE) {
    const oldest = queue.keys().next().value;
    if (oldest === undefined) break;
    queue.delete(oldest);
  }
  pump();
  return queued;
}

/** Pour les tests : plus rien en attente ni au repos (une préparation en cours finit seule). */
export function resetPreviewWarm(): void {
  queue.clear();
  resting.clear();
}

/** Pour les tests : les préparations en cours et en attente. */
export function previewWarmState(): { running: number; queued: number } {
  return { running: running.size, queued: queue.size };
}
