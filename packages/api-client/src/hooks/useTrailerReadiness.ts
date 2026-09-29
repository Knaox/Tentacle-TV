import { useQuery } from "@tanstack/react-query";
import type { TrailerReadiness } from "@tentacle-tv/shared";
import { TentacleApiError, tentacleApiFetch } from "./usePreferences";

/** La clé du diagnostic des bandes-annonces (`GET /api/trailers/readiness`). */
export const TRAILER_READINESS_KEY = ["trailers", "readiness"] as const;

/** Le serveur le garde dix minutes : une fiche ouverte après une autre ne le redemande pas. */
const TRAILER_READINESS_STALE_TIME = 10 * 60_000;

const STATES: ReadonlySet<string> = new Set(["ready", "misconfigured", "unknown"]);

/**
 * Le diagnostic du serveur, validé. `null` quand il n'y en a pas : un serveur
 * Tentacle d'avant ce diagnostic (404) ou une réponse illisible — le guide se
 * tait et le rappel des fiches ne paraît pas, plutôt que de deviner.
 */
export async function fetchTrailerReadiness(): Promise<TrailerReadiness | null> {
  try {
    const raw = await tentacleApiFetch<Partial<TrailerReadiness> | null>("/api/trailers/readiness");
    if (!raw || typeof raw.state !== "string" || !STATES.has(raw.state)) return null;
    return {
      state: raw.state,
      reasons: Array.isArray(raw.reasons) ? raw.reasons : [],
      coverage: typeof raw.coverage === "number" ? raw.coverage : null,
      checkedAt: typeof raw.checkedAt === "string" ? raw.checkedAt : "",
    };
  } catch (error) {
    if (error instanceof TentacleApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Les bandes-annonces sont-elles bien réglées sur ce serveur ? Lu par le guide
 * (tout compte) et par le rappel des fiches. Même écriture pour le web, le
 * miroir, le mobile et les téléviseurs (API commune react-query v4 / v5).
 */
export function useTrailerReadiness(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: TRAILER_READINESS_KEY,
    queryFn: fetchTrailerReadiness,
    enabled: options.enabled ?? true,
    staleTime: TRAILER_READINESS_STALE_TIME,
    // Une panne ne se répare pas en martelant : la prochaine fiche redemandera.
    retry: false,
  });
}
