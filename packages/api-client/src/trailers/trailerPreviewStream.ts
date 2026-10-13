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
    };

/** La clé du cache : le sujet (un titre de la bibliothèque, ou TMDB) et la langue de l'interface. */
export function trailerPreviewQueryKey(subject: TrailerPreviewSubject | null, lang: string) {
  return ["trailer-preview", subject ? trailerPreviewSubjectKey(subject) : null, lang] as const;
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
    if (error instanceof TentacleApiError) return { status: "missing", reason: refusalOf(error) ?? "failed" };
    if (isAbort(error)) return { status: "missing", reason: "failed" };
    // Réseau coupé, réponse non JSON : rien à montrer, la prochaine intention redemandera.
    return { status: "missing", reason: "failed" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}
