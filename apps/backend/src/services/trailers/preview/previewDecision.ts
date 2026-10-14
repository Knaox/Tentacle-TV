/* ------------------------------------------------------------------ */
/*  La décision d'un aperçu : quelle bande-annonce, vérifiée, ou rien   */
/*                                                                     */
/*  Les candidates du CATALOGUE du titre (`previewCandidates.ts` : la  */
/*  saison d'un épisode d'abord, la langue du serveur d'abord, AlloCiné*/
/*  compris pour un client qui lit Dailymotion), essayées dans l'ordre */
/*  — trois par portée, cinq en tout : la saison, puis les autres —    */
/*  jusqu'à la première qui se laisse LIRE : extraite                  */
/*  (yt-dlp, ou les métadonnées de Dailymotion), puis son maître et ses*/
/*  premières listes lus (`prepareTrailer`). Le client ne reçoit jamais*/
/*  un flux qu'on n'a pas ouvert. La mémoire : `previewDecisionMemory`.*/
/*  Deux demandes simultanées en partagent une ; une décision à prendre*/
/*  puise dans le seau du compte et dans le plafond du serveur. YouTube*/
/*  bride l'adresse, ou le budget de l'heure est épuisé                */
/*  (`youtubeGuard.ts`) : plus aucune extraction YouTube d'aperçu — une*/
/*  vidéo Dailymotion reste permise ; sans elle, « aucune lisible » ou */
/*  « réessayez », sans rien retenir par titre. Une langue moins bonne,*/
/*  trouvée après l'échec d'une meilleure, n'est gardée que dix        */
/*  minutes. Personne n'attend plus de douze secondes, sous le délai du*/
/*  client (15 s) : « réessayez dans une seconde », et la décision     */
/*  continue, que la demande suivante rejoint ; une décision que plus  */
/*  personne n'attend cède sa place d'extraction et ne compte plus dans*/
/*  le plafond du serveur.                                             */
/* ------------------------------------------------------------------ */

import type { TrailerVersion } from "../../../trailers/trailerCatalog";
import { buildCatalog } from "../catalog/catalogBuild";
import { holdsSource, peekTrailer } from "../trailerPrepare";
import { prewarmExtraction, type ExtractionOptions } from "../ytExtract";
import { previewRefusal } from "../youtubeGuard";
import { attemptsOf, MAX_ATTEMPTS, previewCandidates, type PreviewCandidate } from "./previewCandidates";
import { clearDecisions, knownDecision, rememberRefusal, type Refusal } from "./previewDecisionMemory";
import { PreviewRateLimiter } from "./previewRateLimit";
import {
  decisionKey, found, guardStop, newStages, playable, warmPlayerStart, type PreviewOutcome, type PreviewTarget,
} from "./previewSteps";

export {
  onPreviewDecisionsChange, restoreDecisions, storedDecisions, type Decision, type StoredDecision,
} from "./previewDecisionMemory";
export type { PreviewOutcome, PreviewTarget };

export { MAX_ATTEMPTS };
/** Plus de nouvel essai passé ce temps : la décision dit « aucune lisible ». */
const DECISION_BUDGET_MS = 25_000;
/** Une extraction d'aperçu passe après les lectures et ne s'éternise pas. */
const PREVIEW_EXTRACTION: ExtractionOptions = { priority: "preview", budgetMs: 20_000 };
/** Décisions à prendre en même temps sur tout le serveur ; au-delà, « réessayez ». */
const MAX_PENDING_DECISIONS = 4;
const BUSY_RETRY_S = 2;
/** Le catalogue n'avait encore rien (une source finit en fond) : redemander bientôt, sans rien retenir. */
const CATALOG_PENDING_RETRY_S = 3;
/** Une langue de repli (la VF a échoué, la VO a répondu) ne se garde pas des heures. */
export const FALLBACK_LANG_TTL_MS = 10 * 60 * 1000;
/** Au-delà, la réponse dit « réessayez » ; la décision, elle, continue (sous les 15 s du client). */
const RESPONSE_BUDGET_MS = 12_000;
const STILL_DECIDING_RETRY_S = 1;

interface Pending {
  task: Promise<PreviewOutcome>;
  /** Les demandes qui attendent encore cette décision. */
  waiters: number;
}

const inflight = new Map<string, Pending>();
const limiter = new PreviewRateLimiter();

/** Quelqu'un attend-il encore la décision `key` ? Sinon, ses extractions cèdent la place. */
const wantedBy = (key: string) => () => (inflight.get(key)?.waiters ?? 0) > 0;

function refuse(key: string, error: Refusal): PreviewOutcome {
  rememberRefusal(key, error);
  return { kind: "refused", error };
}

/**
 * Prend la décision. `known` : la vidéo d'une décision encore valable que le
 * relais a oubliée — essayée d'abord, sans relire le catalogue. Après chaque
 * échec YouTube, le garde-fou : une vérification anti-robot n'est JAMAIS une
 * candidate morte — on s'arrête, sans rien retenir du titre.
 */
async function decide(
  key: string, target: PreviewTarget, account: string, dailymotion: boolean, known?: { ref: string; version?: TrailerVersion },
): Promise<PreviewOutcome> {
  const started = Date.now();
  const stages = newStages();
  const extraction: ExtractionOptions = { ...PREVIEW_EXTRACTION, wanted: wantedBy(key) };
  const again = known ? await playable(known.ref, stages, extraction) : null;
  if (known && again) return found(key, known.ref, again, started, "reprise", stages, { version: known.version });
  // La reprise ne se lit plus, et YouTube bride l'adresse : rien à essayer pour un client YouTube seul.
  const stoppedEarly = known && !dailymotion ? guardStop() : null;
  if (stoppedEarly) return stoppedEarly;
  const catalog = await buildCatalog(target.catalog, account);
  stages.catalog = Date.now() - started;
  let candidates: PreviewCandidate[] = previewCandidates(catalog.entries, { dailymotion });
  if (candidates.length === 0) {
    console.log(`[trailers] aperçu ${key} : aucune bande-annonce${catalog.complete ? "" : " (catalogue incomplet)"}`);
    // Une source finit encore en fond : la réponse viendra à la demande suivante.
    return catalog.complete ? refuse(key, "no_trailer") : { kind: "limited", retryAfterS: CATALOG_PENDING_RETRY_S };
  }
  // YouTube bride l'adresse : seules les vidéos Dailymotion restent à essayer.
  const stop = guardStop();
  if (stop) candidates = candidates.filter((candidate) => !candidate.youtube);
  if (candidates.length === 0 && stop) return stop;
  candidates = attemptsOf(candidates);
  const bestLang = candidates[0].langRank;
  for (const [index, { ref, youtube, langRank, version }] of candidates.entries()) {
    if (index > 0 && Date.now() - started >= DECISION_BUDGET_MS) break;
    const resolved = await playable(ref, stages, extraction);
    if (!resolved) {
      const blocked = youtube ? guardStop() : null;
      if (blocked) return blocked;
      continue;
    }
    // Une meilleure langue a échoué avant : ce repli ne dure que dix minutes.
    const fallback = langRank > bestLang;
    const how = `essai ${index + 1}/${candidates.length}${fallback ? ", langue de repli gardée 10 min" : ""}`;
    return found(key, ref, resolved, started, how, stages, { maxTtlMs: fallback ? FALLBACK_LANG_TTL_MS : Infinity, version });
  }
  console.warn(`[trailers] aperçu ${key} : aucune lisible (${candidates.length} candidate(s), ${Date.now() - started} ms)`);
  return refuse(key, "unavailable");
}

/**
 * L'aperçu de `target` pour `account` dans la langue `lang` : la décision
 * gardée, partagée ou prise ici. `dailymotion` : le client sait lire un aperçu
 * Dailymotion (`dm=1`) — sa décision est à part de celle d'un client d'avant.
 */
export async function decidePreview(
  target: PreviewTarget, lang: string | undefined, account: string, options: { dailymotion?: boolean } = {},
): Promise<PreviewOutcome> {
  const dailymotion = options.dailymotion === true;
  const key = decisionKey(target, lang, dailymotion);
  const known = knownDecision(key);
  if (known?.kind === "refused") return known;
  const ready = known?.kind === "found" ? peekTrailer(known.ref) : null;
  if (known?.kind === "found" && ready) {
    // Ses premiers segments, s'ils ne sont plus en mémoire, repartent pour ce lecteur-ci.
    warmPlayerStart(known.ref);
    return known.version ? { kind: "found", ref: known.ref, resolved: ready, version: known.version } : { kind: "found", ref: known.ref, resolved: ready };
  }
  const pending = inflight.get(key);
  if (pending) return awaitDecision(pending);
  // Une reprise dont le relais tient encore la SOURCE : ses listes se relisent, rien n'est demandé à YouTube.
  const heldReprise = known?.kind === "found" && holdsSource(known.ref);
  // YouTube bride l'adresse, et ce client ne lit que YouTube : réponse immédiate, sans catalogue ni seau.
  const stop = heldReprise || dailymotion ? null : guardStop();
  if (stop) return stop;
  // Le plafond ne compte que les décisions qu'on attend : une rangée déjà quittée ne bloque pas la carte survolée.
  if (awaitedDecisions() >= MAX_PENDING_DECISIONS) return { kind: "limited", retryAfterS: BUSY_RETRY_S };
  const verdict = limiter.take(account);
  if (!verdict.ok) return { kind: "limited", retryAfterS: verdict.retryAfterS };
  // Une extraction va sans doute suivre : l'ouvrier yt-dlp se charge pendant que le catalogue répond.
  if (!heldReprise && !previewRefusal()) prewarmExtraction();
  const task = decide(key, target, account, dailymotion, known?.kind === "found" ? known : undefined)
    .catch((err: unknown) => {
      console.warn(`[trailers] aperçu ${key} : décision interrompue (${err instanceof Error ? err.message : String(err)})`);
      return refuse(key, "unavailable");
    })
    .finally(() => inflight.delete(key));
  const entry: Pending = { task, waiters: 0 };
  inflight.set(key, entry);
  return awaitDecision(entry);
}

/** Un survol décide-t-il déjà `key` ? La préparation en fond ne le double pas. */
export function decisionInFlight(key: string): boolean {
  return inflight.has(key);
}

function awaitedDecisions(): number {
  let count = 0;
  for (const pending of inflight.values()) if (pending.waiters > 0) count++;
  return count;
}

/**
 * Attend la décision, douze secondes au plus : au-delà, « réessayez dans une
 * seconde » — la décision continue, la demande suivante la rejoint (sans
 * puiser dans le seau) ou trouve sa réponse gardée.
 */
async function awaitDecision(pending: Pending): Promise<PreviewOutcome> {
  pending.waiters++;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<PreviewOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "limited", retryAfterS: STILL_DECIDING_RETRY_S }), RESPONSE_BUDGET_MS);
  });
  try {
    return await Promise.race([pending.task, late]);
  } finally {
    clearTimeout(timer);
    pending.waiters--;
  }
}

/** Pour les tests : repartir sans décision, sans seau. */
export function resetPreviewDecisions(): void {
  clearDecisions();
  inflight.clear();
  limiter.clear();
}
