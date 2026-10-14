import {
  isEmbedFallback, parseTrailerResolve, trailerReportBody, trailerResolveQuery,
  type RelayedTrailerPlayback, type TrailerStream,
} from "@tentacle-tv/shared";
import { TentacleApiError, tentacleApiFetch } from "../hooks/usePreferences";

/**
 * Ce que le lecteur complet des bandes-annonces (web, bureau) demande au
 * serveur : le flux RELAYÉ d'une vidéo (`/resolve`), sa préparation à
 * l'intention (`/prepare`) et le compte rendu de la lecture (`/report`).
 *
 * Un refus n'est pas une panne : c'est une RÉPONSE, que le lecteur traduit en
 * geste (`trailerFailureStep`, shared) —
 * - `embed` : le serveur ne peut pas extraire YouTube maintenant (budget,
 *   blocage) : le lecteur officiel, pour cette bande-annonce ;
 * - `unavailable` : aucun flux lisible pour cette vidéo : la suivante ;
 * - `failed` : panne, réponse illisible : la suivante aussi.
 */
export type TrailerResolveResult =
  | { status: "ready"; stream: TrailerStream }
  | { status: "embed" }
  | { status: "unavailable" }
  | { status: "failed" };

function bodyOf(error: TentacleApiError): unknown {
  try {
    return JSON.parse(error.message);
  } catch {
    return null;
  }
}

/** Le flux de `playback`, en adresses absolues derrière `serverUrl`. `signal` : l'abandon remonte tel quel. */
export async function fetchTrailerResolve(
  playback: RelayedTrailerPlayback,
  serverUrl: string,
  signal?: AbortSignal,
): Promise<TrailerResolveResult> {
  try {
    const raw = await tentacleApiFetch<unknown>(`/api/trailers/resolve?${trailerResolveQuery(playback)}`, { signal });
    const stream = parseTrailerResolve(raw, serverUrl);
    return stream ? { status: "ready", stream } : { status: "unavailable" };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof TentacleApiError) {
      if (isEmbedFallback(error.status, bodyOf(error))) return { status: "embed" };
      if (error.status === 404) return { status: "unavailable" };
    }
    return { status: "failed" };
  }
}

/**
 * Fait préparer la vidéo — extraction, maître, premières listes — pendant que
 * l'utilisateur hésite sur le bouton : le départ sera immédiat. Sans attendre,
 * sans erreur (le lancement refera ce qui manque).
 */
export function prepareTrailerPlayback(playback: RelayedTrailerPlayback): void {
  void tentacleApiFetch(`/api/trailers/prepare?${trailerResolveQuery(playback)}`).catch(() => undefined);
}

/**
 * Dit au serveur comment la lecture s'est passée — une ligne de journal par
 * lecture (`[trailers]`). La réponse est un 204, que `tentacleApiFetch` ne
 * sait pas lire : la demande part quand même, l'erreur de lecture est ignorée.
 */
export function reportTrailerPlayback(playback: RelayedTrailerPlayback, outcome: { ok: boolean; ms: number; reason?: string }): void {
  const body = JSON.stringify(trailerReportBody(playback, outcome));
  void tentacleApiFetch("/api/trailers/report", { method: "POST", body }).catch(() => undefined);
}
