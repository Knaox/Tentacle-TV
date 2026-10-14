/* ------------------------------------------------------------------ */
/*  La décision d'un aperçu : quelle bande-annonce, vérifiée, ou rien   */
/*                                                                     */
/*  Les candidates du titre (`previewCandidates.ts`), essayées dans    */
/*  l'ordre — trois au plus — jusqu'à la première qui se laisse LIRE : */
/*  extraite (yt-dlp), puis son maître et ses premières listes lus     */
/*  chez googlevideo (`prepareTrailer`). Le client ne reçoit jamais    */
/*  un flux qu'on n'a pas ouvert. La décision est gardée par (titre,   */
/*  langue) : trouvée, jusqu'à l'échéance des URL ; aucune bande-      */
/*  annonce, une heure ; aucune lisible, dix minutes. Deux demandes    */
/*  simultanées en partagent une ; une décision à prendre puise dans   */
/*  le seau du compte et dans le plafond du serveur. YouTube bride     */
/*  l'adresse, ou le budget de l'heure est épuisé (`youtubeGuard.ts`) :*/
/*  plus aucune extraction d'aperçu — « aucune lisible » ou            */
/*  « réessayez », tout de suite, sans rien retenir par titre.         */
/* ------------------------------------------------------------------ */

import {
  TRAILER_PREVIEW_NO_TRAILER_TTL_MS, TRAILER_PREVIEW_UNAVAILABLE_TTL_MS,
} from "../../../trailers/trailerPreview";
import { resolveTrailer, type ResolvedTrailer } from "../trailerRelay";
import { peekTrailer, prepareTrailer, warmStart } from "../trailerPrepare";
import type { ExtractionOptions } from "../ytExtract";
import { fetchTitleVideos } from "../titleVideos";
import { previewRefusal } from "../youtubeGuard";
import { previewCandidates } from "./previewCandidates";
import { PreviewRateLimiter } from "./previewRateLimit";
import type { PreviewTitle } from "./previewTitle";
import { TtlLru } from "./ttlLru";

type Refusal = "no_trailer" | "unavailable";

export type PreviewOutcome =
  | { kind: "found"; ytId: string; resolved: ResolvedTrailer }
  | { kind: "refused"; error: Refusal }
  /** Trop de demandes (le compte) ou trop de décisions en cours (le serveur) : rien n'est retenu. */
  | { kind: "limited"; retryAfterS: number };

type Decision = { kind: "found"; ytId: string } | { kind: "refused"; error: Refusal };

/** Au-delà de trois essais, le survol est passé depuis longtemps. */
export const MAX_ATTEMPTS = 3;
/** Plus de nouvel essai passé ce temps : la décision dit « aucune lisible ». */
const DECISION_BUDGET_MS = 25_000;
/** Une extraction d'aperçu passe après les lectures et ne s'éternise pas. */
const PREVIEW_EXTRACTION: ExtractionOptions = { priority: "preview", budgetMs: 20_000 };
/** Décisions à prendre en même temps sur tout le serveur ; au-delà, « réessayez ». */
const MAX_PENDING_DECISIONS = 4;
const BUSY_RETRY_S = 2;
const MAX_DECISIONS = 1_000;

const decisions = new TtlLru<Decision>(MAX_DECISIONS);
const inflight = new Map<string, Promise<PreviewOutcome>>();
const limiter = new PreviewRateLimiter();

function remember(key: string, decision: Decision, ttlMs: number): void {
  decisions.set(key, decision, ttlMs);
}

function refuse(key: string, error: Refusal): PreviewOutcome {
  remember(key, { kind: "refused", error }, error === "no_trailer" ? TRAILER_PREVIEW_NO_TRAILER_TTL_MS : TRAILER_PREVIEW_UNAVAILABLE_TTL_MS);
  return { kind: "refused", error };
}

/** Le départ du lecteur au plus haut — listes et premiers segments — lu d'avance, sans rien attendre. */
function warm(ytId: string): void {
  void warmStart(ytId).catch(() => undefined);
}

/** Où passe le temps d'une décision (ms), pour le journal : de quoi savoir quoi accélérer. */
interface Stages {
  tmdb: number;
  extract: number;
  verify: number;
}

const newStages = (): Stages => ({ tmdb: 0, extract: 0, verify: 0 });

/**
 * La vidéo se laisse-t-elle lire : extraite, puis son maître et ses premières
 * listes lus ? Le départ au plus haut part EN MÊME TEMPS (même maître, lu une
 * fois) et ne retarde pas la réponse : le lecteur trouvera ses premiers
 * segments en mémoire, ou en route.
 */
async function playable(ytId: string, stages: Stages): Promise<ResolvedTrailer | null> {
  let mark = Date.now();
  const resolved = await resolveTrailer(ytId, PREVIEW_EXTRACTION);
  stages.extract += Date.now() - mark;
  if (!resolved) return null;
  warm(ytId);
  mark = Date.now();
  const readable = await prepareTrailer(ytId, PREVIEW_EXTRACTION);
  stages.verify += Date.now() - mark;
  return readable ? resolved : null;
}

/**
 * Le garde-fou YouTube (`youtubeGuard.ts`) interdit-il d'extraire pour un
 * aperçu ? Suspendu : « aucune lisible », sans rien retenir par titre — le
 * disjoncteur EST la mémoire, et sa fermeture rend les aperçus aussitôt ;
 * budget de l'heure épuisé : « réessayez » dans le délai honnête.
 */
function guardStop(): PreviewOutcome | null {
  const refusal = previewRefusal();
  if (!refusal) return null;
  if (refusal.kind === "blocked") return { kind: "refused", error: "unavailable" };
  return { kind: "limited", retryAfterS: Math.max(1, Math.ceil(refusal.retryAfterMs / 1000)) };
}

function found(key: string, ytId: string, resolved: ResolvedTrailer, started: number, how: string, stages: Stages): PreviewOutcome {
  remember(key, { kind: "found", ytId }, resolved.validUntil - Date.now());
  const detail = `TMDB ${stages.tmdb}, extraction ${stages.extract}, vérification ${stages.verify}`;
  console.log(`[trailers] aperçu ${key} : ${ytId} (${resolved.kind}, ${resolved.heights[0] ?? "mp4"}) en ${Date.now() - started} ms (${detail}), ${how}`);
  return { kind: "found", ytId, resolved };
}

/**
 * Prend la décision. `known` : la vidéo d'une décision encore valable que le
 * relais a oubliée — essayée d'abord, sans relire TMDB. Après chaque échec,
 * le garde-fou : une vérification anti-robot (ou une limite) n'est JAMAIS une
 * candidate morte — on n'essaie pas la suivante, on ne retient rien du titre.
 * Une candidate que le relais tient déjà se sert même pendant un blocage :
 * seule une extraction est refusée (`ytExtract.ts`).
 */
async function decide(key: string, title: PreviewTitle, lang: string | undefined, known?: string): Promise<PreviewOutcome> {
  const started = Date.now();
  const stages = newStages();
  const again = known ? await playable(known, stages) : null;
  if (known && again) return found(key, known, again, started, "reprise", stages);
  const stoppedEarly = known ? guardStop() : null;
  if (stoppedEarly) return stoppedEarly;
  const tmdbStarted = Date.now();
  const tmdb = title.tmdb ? await fetchTitleVideos(title.tmdb.id, title.tmdb.mediaType, lang) : { videos: [], complete: true };
  stages.tmdb = Date.now() - tmdbStarted;
  const candidates = previewCandidates(title.jellyfin, tmdb.videos, lang).slice(0, MAX_ATTEMPTS);
  if (candidates.length === 0) {
    // TMDB muet : une absence qui n'en est peut-être pas une — retenue comme « aucune lisible ».
    console.log(`[trailers] aperçu ${key} : aucune bande-annonce${tmdb.complete ? "" : " (TMDB sans réponse)"}`);
    return refuse(key, tmdb.complete ? "no_trailer" : "unavailable");
  }
  for (const [index, ytId] of candidates.entries()) {
    if (index > 0 && Date.now() - started >= DECISION_BUDGET_MS) break;
    const resolved = await playable(ytId, stages);
    if (resolved) return found(key, ytId, resolved, started, `essai ${index + 1}/${candidates.length}`, stages);
    const stop = guardStop();
    if (stop) return stop;
  }
  console.warn(`[trailers] aperçu ${key} : aucune lisible (${candidates.length} candidate(s), ${Date.now() - started} ms)`);
  return refuse(key, "unavailable");
}

/**
 * L'aperçu du titre pour `account` dans la langue `lang` : la décision
 * gardée, partagée ou prise ici. Une bande-annonce trouvée se sert telle
 * quelle tant que le relais la tient prête ; s'il l'a oubliée, la décision se
 * reprend — comme une nouvelle, limite et plafond compris.
 */
export async function decidePreview(title: PreviewTitle, lang: string | undefined, account: string): Promise<PreviewOutcome> {
  const key = `${title.key}|${lang ?? "-"}`;
  const known = decisions.get(key);
  if (known?.kind === "refused") return known;
  const ready = known?.kind === "found" ? peekTrailer(known.ytId) : null;
  if (known?.kind === "found" && ready) {
    // Ses premiers segments, s'ils ne sont plus en mémoire, repartent pour ce lecteur-ci.
    warm(known.ytId);
    return { kind: "found", ytId: known.ytId, resolved: ready };
  }
  const pending = inflight.get(key);
  if (pending) return pending;
  // YouTube bride l'adresse, ou le budget de l'heure est épuisé : réponse immédiate, sans TMDB ni extraction.
  const stop = guardStop();
  if (stop) return stop;
  if (inflight.size >= MAX_PENDING_DECISIONS) return { kind: "limited", retryAfterS: BUSY_RETRY_S };
  const verdict = limiter.take(account);
  if (!verdict.ok) return { kind: "limited", retryAfterS: verdict.retryAfterS };
  const task = decide(key, title, lang, known?.kind === "found" ? known.ytId : undefined)
    .catch((err: unknown) => {
      console.warn(`[trailers] aperçu ${key} : décision interrompue (${err instanceof Error ? err.message : String(err)})`);
      return refuse(key, "unavailable");
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

/** Pour les tests : repartir sans décision, sans seau. */
export function resetPreviewDecisions(): void {
  decisions.clear();
  inflight.clear();
  limiter.clear();
}
