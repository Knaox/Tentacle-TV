import {
  TRAILER_PREVIEW_NO_TRAILER_TTL_MS,
  TRAILER_PREVIEW_TIMING,
  TRAILER_PREVIEW_UNAVAILABLE_TTL_MS,
  isTrailerPreview,
  trailerPreviewSubjectKey,
  trailerPreviewSubjectPath,
  type TrailerPreview,
  type TrailerPreviewRefusal,
  type TrailerPreviewSubject,
} from "@tentacle-tv/shared";
import { TentacleApiError, tentacleApiFetch } from "../hooks/usePreferences";

/**
 * La bande-annonce d'un aperçu au survol, telle que le serveur l'a choisie et
 * VÉRIFIÉE (`GET /api/trailers/preview`). Un refus n'est pas une erreur :
 * c'est une RÉPONSE — « rien à montrer » —, gardée en cache autant que le
 * serveur garde sa décision, et jamais relancée en boucle.
 */
export type TrailerPreviewStreamResult =
  | { status: "found"; preview: TrailerPreview }
  | {
      status: "missing";
      /** Le refus du serveur ; `unreadable` : réponse illisible ; `failed` : panne, délai dépassé. */
      reason: TrailerPreviewRefusal | "unreadable" | "failed";
      /** `rate_limited` : dans combien de temps redemander (`Retry-After`, borné) — absent s'il est illisible. */
      retryAfterMs?: number;
    };

/** La clé du cache : le sujet (un titre de la bibliothèque, ou TMDB) et la langue de l'interface. */
export function trailerPreviewQueryKey(subject: TrailerPreviewSubject | null, lang: string) {
  return ["trailer-preview", subject ? trailerPreviewSubjectKey(subject) : null, lang] as const;
}

/**
 * Un refus PASSAGER — le serveur décide déjà trop d'aperçus (429), ou il n'a pas
 * répondu (panne, délai) : il ne vaut que le temps d'attendre, et si le survol
 * tient, l'aperçu redemande à son échéance (`previewMachine.ts`).
 */
export function isTransientPreviewRefusal(result: TrailerPreviewStreamResult | undefined): boolean {
  return result?.status === "missing" && (result.reason === "rate_limited" || result.reason === "failed");
}

/**
 * Le délai d'un 429 : `Retry-After` en secondes, borné à [1 s, 10 s] ;
 * `undefined` s'il manque — ou s'il est caché : un en-tête que le serveur
 * n'expose pas n'est pas lisible d'une autre origine (le bureau, `tentacle://app`).
 */
export function previewRetryAfterMs(header: string | null | undefined): number | undefined {
  const seconds = header == null || header.trim() === "" ? Number.NaN : Number(header);
  if (!Number.isFinite(seconds)) return undefined;
  const { rateLimitMinMs, rateLimitMaxMs } = TRAILER_PREVIEW_TIMING;
  return Math.min(rateLimitMaxMs, Math.max(rateLimitMinMs, Math.round(seconds * 1000)));
}

/**
 * Quand redemander, après le `retries`-ième refus passager du survol en cours :
 * le délai du 429 s'il est connu ; sinon 2 s puis 4 s (le serveur rend ses
 * jetons d'aperçu toutes les 5 s : deux essais trop rapprochés tomberaient
 * encore sur un refus) ; 10 s après une panne.
 */
export function previewRetryDelayMs(result: TrailerPreviewStreamResult, retries: number): number {
  const { rateLimitDefaultMs, rateLimitMaxMs, transientFailureMs } = TRAILER_PREVIEW_TIMING;
  if (result.status !== "missing") return 0;
  if (result.reason === "rate_limited") {
    return result.retryAfterMs ?? Math.min(rateLimitMaxMs, rateLimitDefaultMs * 2 ** Math.max(0, retries));
  }
  return result.reason === "failed" ? transientFailureMs : trailerPreviewResultTtl(result, 0);
}

/** Combien de temps une réponse vaut, depuis son arrivée — au-delà, la prochaine intention redemande. */
export function trailerPreviewResultTtl(result: TrailerPreviewStreamResult | undefined, receivedAt: number): number {
  if (!result) return 0;
  if (result.status === "found") {
    // Le jeton du relais expire (`expiresAt`) : une minute de marge pour une lecture qui démarre.
    const untilExpiry = result.preview.expiresAt - 60_000 - receivedAt;
    return Math.max(0, Math.min(untilExpiry, TRAILER_PREVIEW_TIMING.streamCacheMaxMs));
  }
  switch (result.reason) {
    case "no_trailer":
    case "invalid_request":
      return TRAILER_PREVIEW_NO_TRAILER_TTL_MS;
    case "rate_limited":
      return result.retryAfterMs ?? TRAILER_PREVIEW_TIMING.rateLimitDefaultMs;
    case "failed":
      return TRAILER_PREVIEW_TIMING.transientFailureMs;
    default:
      return TRAILER_PREVIEW_UNAVAILABLE_TTL_MS;
  }
}

const REFUSALS: ReadonlySet<string> = new Set<TrailerPreviewRefusal>(["invalid_request", "no_trailer", "unavailable", "rate_limited"]);

/** Le refus que dit le corps d'une réponse d'erreur (`{ error }`), s'il en est un du contrat. */
function refusalOf(error: TentacleApiError): TrailerPreviewRefusal | null {
  try {
    const body = JSON.parse(error.message) as { error?: unknown };
    return typeof body.error === "string" && REFUSALS.has(body.error) ? (body.error as TrailerPreviewRefusal) : null;
  } catch {
    return null;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Demande l'aperçu de `subject`. `signal` : l'abandon par TanStack (survol
 * fini avant la réponse) remonte tel quel ; le délai propre de la demande
 * (`fetchTimeoutMs`), lui, vaut « rien à montrer ».
 */
export async function fetchTrailerPreviewStream(
  subject: TrailerPreviewSubject,
  lang: string,
  signal?: AbortSignal,
  timeoutMs: number = TRAILER_PREVIEW_TIMING.fetchTimeoutMs,
): Promise<TrailerPreviewStreamResult> {
  const path = trailerPreviewSubjectPath(subject, lang);
  if (!path) return { status: "missing", reason: "invalid_request" };

  const controller = new AbortController();
  const forward = () => controller.abort();
  signal?.addEventListener("abort", forward, { once: true });
  const timer = setTimeout(forward, timeoutMs);
  try {
    const raw = await tentacleApiFetch<unknown>(path, { signal: controller.signal });
    return isTrailerPreview(raw) ? { status: "found", preview: raw } : { status: "missing", reason: "unreadable" };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof TentacleApiError) {
      const reason = refusalOf(error) ?? "failed";
      const retryAfterMs = reason === "rate_limited" ? previewRetryAfterMs(error.headers?.get("Retry-After")) : undefined;
      return retryAfterMs === undefined ? { status: "missing", reason } : { status: "missing", reason, retryAfterMs };
    }
    if (isAbort(error)) return { status: "missing", reason: "failed" };
    // Réseau coupé, réponse non JSON : rien à montrer, la prochaine intention redemandera.
    return { status: "missing", reason: "failed" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}
