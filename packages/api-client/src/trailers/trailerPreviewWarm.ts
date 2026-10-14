import type { QueryClient } from "@tanstack/react-query";
import {
  TRAILER_PREVIEW_WARM_ROUTE,
  readTrailerPreviewWarmResponse,
  type TrailerPreviewSubject,
  type TrailerPreviewWarmResponse,
  type TrailerPreviewWarmSubject,
} from "@tentacle-tv/shared";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { trailerPreviewQueryKey, trailerPreviewResultTtl, type TrailerPreviewStreamResult } from "./trailerPreviewStream";

/**
 * La PRÉPARATION des aperçus (`POST /api/trailers/preview/warm`, capacité
 * `trailers.previewWarm`) : le client dit les titres que ses cartes montrent,
 * le serveur prépare leur aperçu en fond et rend tout de suite ceux qui sont
 * prêts — rangés ici dans le cache des aperçus (`["trailer-preview", …]`) :
 * leur survol n'a plus rien à demander, la vidéo part à l'intention.
 */

/** Un sujet du client sous la forme de la demande. */
export function trailerPreviewWarmSubject(subject: TrailerPreviewSubject): TrailerPreviewWarmSubject {
  return subject.kind === "item" ? { itemId: subject.itemId } : { tmdbId: subject.tmdbId, mediaType: subject.mediaType };
}

function subjectOf(subject: TrailerPreviewWarmSubject): TrailerPreviewSubject {
  return "itemId" in subject ? { kind: "item", itemId: subject.itemId } : { kind: "tmdb", tmdbId: subject.tmdbId, mediaType: subject.mediaType };
}

/**
 * Demande la préparation de `subjects` (40 au plus). `null` : refus (trop de
 * demandes), panne, réponse illisible — rien à faire, la prochaine demande
 * réessaiera. Jamais d'exception.
 */
export async function fetchTrailerPreviewWarm(subjects: readonly TrailerPreviewSubject[], lang: string): Promise<TrailerPreviewWarmResponse | null> {
  try {
    const body = { subjects: subjects.map(trailerPreviewWarmSubject), lang, dailymotion: true };
    const raw = await tentacleApiFetch<unknown>(TRAILER_PREVIEW_WARM_ROUTE, { method: "POST", body: JSON.stringify(body) });
    return readTrailerPreviewWarmResponse(raw);
  } catch {
    return null;
  }
}

/** Une réponse gardée vaut encore au moins ce temps : inutile de la remplacer. */
const STILL_GOOD_MS = 5 * 60_000;

/** Le cache tient-il déjà, pour ce sujet, un aperçu qui vaut encore un moment ? */
export function trailerPreviewCached(queryClient: QueryClient, subject: TrailerPreviewSubject, lang: string, now = Date.now()): boolean {
  const state = queryClient.getQueryState<TrailerPreviewStreamResult>(trailerPreviewQueryKey(subject, lang));
  if (state?.data?.status !== "found") return false;
  return state.dataUpdatedAt + trailerPreviewResultTtl(state.data, state.dataUpdatedAt) - now > STILL_GOOD_MS;
}

/** Range les aperçus prêts de la réponse dans le cache des aperçus (sans écraser un aperçu qui vaut encore). */
export function seedTrailerPreviews(queryClient: QueryClient, response: TrailerPreviewWarmResponse, lang: string, now = Date.now()): void {
  for (const { subject: raw, preview } of response.ready) {
    const subject = subjectOf(raw);
    if (trailerPreviewCached(queryClient, subject, lang, now)) continue;
    const result: TrailerPreviewStreamResult = { status: "found", preview };
    queryClient.setQueryData(trailerPreviewQueryKey(subject, lang), result, { updatedAt: now });
  }
}
