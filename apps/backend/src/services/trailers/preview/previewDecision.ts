/* ------------------------------------------------------------------ */
/*  La décision d'un aperçu : quelle bande-annonce, vérifiée, ou rien   */
/*                                                                     */
/*  Les candidates du titre (`previewCandidates.ts`), essayées dans    */
/*  l'ordre — trois au plus — jusqu'à la première qui se laisse LIRE : */
/*  extraite (yt-dlp), puis son maître et ses premières listes lus     */
/*  chez googlevideo (`prepareTrailer`). Le client ne reçoit jamais    */
/*  un flux qu'on n'a pas ouvert. La décision est gardée par (titre,   */
/*  langue) : trouvée, jusqu'à l'échéance des URL ; aucune bande-      */
/*  annonce, une heure ; aucune lisible, une minute. Deux demandes     */
/*  simultanées en partagent une ; une décision à prendre puise dans   */
/*  le seau du compte et dans le plafond du serveur.                   */
/* ------------------------------------------------------------------ */

import {
  TRAILER_PREVIEW_NO_TRAILER_TTL_MS, TRAILER_PREVIEW_UNAVAILABLE_TTL_MS,
} from "../../../trailers/trailerPreview";
import { peekTrailer, prepareTrailer, resolveTrailer, type ResolvedTrailer } from "../trailerRelay";
import type { ExtractionOptions } from "../ytExtract";
import { fetchTitleVideos } from "../titleVideos";
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

/** La vidéo se laisse-t-elle lire : extraite, puis son maître et ses premières listes lus ? */
async function playable(ytId: string): Promise<ResolvedTrailer | null> {
  const resolved = await resolveTrailer(ytId, PREVIEW_EXTRACTION);
  return resolved && (await prepareTrailer(ytId, PREVIEW_EXTRACTION)) ? resolved : null;
}

function found(key: string, ytId: string, resolved: ResolvedTrailer, started: number, how: string): PreviewOutcome {
  remember(key, { kind: "found", ytId }, resolved.validUntil - Date.now());
  console.log(`[trailers] aperçu ${key} : ${ytId} (${resolved.kind}, ${resolved.heights[0] ?? "mp4"}) en ${Date.now() - started} ms, ${how}`);
  return { kind: "found", ytId, resolved };
}

/**
 * Prend la décision. `known` : la vidéo d'une décision encore valable que le
 * relais a oubliée — essayée d'abord, sans relire TMDB.
 */
async function decide(key: string, title: PreviewTitle, lang: string | undefined, known?: string): Promise<PreviewOutcome> {
  const started = Date.now();
  const again = known ? await playable(known) : null;
  if (known && again) return found(key, known, again, started, "reprise");
  const tmdb = title.tmdb ? await fetchTitleVideos(title.tmdb.id, title.tmdb.mediaType, lang) : { videos: [], complete: true };
  const candidates = previewCandidates(title.jellyfin, tmdb.videos, lang).slice(0, MAX_ATTEMPTS);
  if (candidates.length === 0) {
    // TMDB muet : une absence qui n'en est peut-être pas une — retenue une minute seulement.
    console.log(`[trailers] aperçu ${key} : aucune bande-annonce${tmdb.complete ? "" : " (TMDB sans réponse)"}`);
    return refuse(key, tmdb.complete ? "no_trailer" : "unavailable");
  }
  for (const [index, ytId] of candidates.entries()) {
    if (index > 0 && Date.now() - started >= DECISION_BUDGET_MS) break;
    const resolved = await playable(ytId);
    if (resolved) return found(key, ytId, resolved, started, `essai ${index + 1}/${candidates.length}`);
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
  if (known?.kind === "found" && ready) return { kind: "found", ytId: known.ytId, resolved: ready };
  const pending = inflight.get(key);
  if (pending) return pending;
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
