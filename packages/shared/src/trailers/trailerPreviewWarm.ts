/**
 * La PRÉPARATION des aperçus — le contrat de `POST /api/trailers/preview/warm`,
 * que le serveur déclare par la capacité `trailers.previewWarm`.
 *
 * Le client dit quels titres sont À L'ÉCRAN (ses cartes visibles, 40 au
 * plus) ; le serveur prépare leur aperçu EN FOND, dans l'ordre où ils sont
 * apparus (les derniers d'abord) : le catalogue (TMDB, AlloCiné), puis la
 * vidéo retenue quand elle ne coûte rien à YouTube — une bande-annonce
 * AlloCiné (Dailymotion), ou une vidéo YouTube que le relais tient déjà.
 * JAMAIS d'extraction YouTube : elle n'a lieu qu'au survol, sous ses
 * garde-fous. La décision prise en fond est celle que le survol aurait prise
 * (même catalogue, même ordre), ou rien.
 *
 * La réponse rend tout de suite les aperçus DÉJÀ prêts — le même corps que
 * `GET /api/trailers/preview` — : le survol de ces titres n'a plus rien à
 * demander, la vidéo part à l'intention. Les autres se préparent ; une demande
 * suivante (la page qui défile, le même écran un peu plus tard) les trouve
 * prêts.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/trailers/` (voir
 * `trailerPreview.ts`). On le modifie ICI.
 */

import {
  isTrailerPreview, previewItemIdOf, previewLangOf, previewTmdbIdOf,
  type TrailerPreview, type TrailerPreviewItemTarget, type TrailerPreviewMediaType,
} from "./trailerPreview";

/** La route, préfixe compris. */
export const TRAILER_PREVIEW_WARM_ROUTE = "/api/trailers/preview/warm";

/** Les titres d'une demande, au plus — un écran de cartes. Au-delà, ils sont ignorés. */
export const TRAILER_PREVIEW_WARM_MAX_SUBJECTS = 40;

/** Un titre à préparer : de la bibliothèque (`itemId`), ou hors bibliothèque (TMDB). */
export type TrailerPreviewWarmSubject = TrailerPreviewItemTarget | { tmdbId: number; mediaType: TrailerPreviewMediaType };

/** Le corps de la demande. `dailymotion` : le client lit un aperçu AlloCiné (le `dm=1` de `GET /preview`). */
export interface TrailerPreviewWarmRequest {
  subjects: TrailerPreviewWarmSubject[];
  lang?: string;
  dailymotion?: boolean;
}

/** Un aperçu déjà prêt : son titre (sous la forme de la demande, normalisée) et le corps de `GET /preview`. */
export interface TrailerPreviewWarmReady {
  subject: TrailerPreviewWarmSubject;
  preview: TrailerPreview;
}

/** 200 — ce qui est prêt, et combien de titres cette demande a mis en préparation. */
export interface TrailerPreviewWarmResponse {
  ready: TrailerPreviewWarmReady[];
  queued: number;
}

/** La clé d'un titre de la demande (`item:<id>`, `tmdb:movie:603`) — celle des sujets côté client. */
export function trailerPreviewWarmKey(subject: TrailerPreviewWarmSubject): string {
  return "itemId" in subject ? `item:${subject.itemId}` : `tmdb:${subject.mediaType}:${subject.tmdbId}`;
}

/** Un titre lisible, sous sa forme normalisée ; `null` sinon. */
export function trailerPreviewWarmSubjectOf(value: unknown): TrailerPreviewWarmSubject | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { itemId?: unknown; tmdbId?: unknown; mediaType?: unknown };
  if (raw.itemId !== undefined) {
    if (raw.tmdbId !== undefined || raw.mediaType !== undefined) return null;
    const itemId = previewItemIdOf(raw.itemId);
    return itemId ? { itemId } : null;
  }
  const tmdbId = previewTmdbIdOf(raw.tmdbId);
  const mediaType = raw.mediaType === "movie" || raw.mediaType === "tv" ? raw.mediaType : null;
  return tmdbId !== null && mediaType ? { tmdbId, mediaType } : null;
}

/**
 * La demande que porte un corps JSON — le serveur la lit avec ces règles :
 * les titres illisibles et les doublons sont écartés, 40 au plus. `null` :
 * aucun titre lisible (rien à préparer), ou un corps qui n'en est pas un.
 */
export function parseTrailerPreviewWarmBody(body: unknown): TrailerPreviewWarmRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body as { subjects?: unknown; lang?: unknown; dailymotion?: unknown };
  if (!Array.isArray(raw.subjects)) return null;
  const seen = new Set<string>();
  const subjects: TrailerPreviewWarmSubject[] = [];
  for (const candidate of raw.subjects) {
    if (subjects.length >= TRAILER_PREVIEW_WARM_MAX_SUBJECTS) break;
    const subject = trailerPreviewWarmSubjectOf(candidate);
    if (!subject) continue;
    const key = trailerPreviewWarmKey(subject);
    if (seen.has(key)) continue;
    seen.add(key);
    subjects.push(subject);
  }
  if (subjects.length === 0) return null;
  const lang = previewLangOf(raw.lang);
  return {
    subjects,
    ...(lang ? { lang } : {}),
    ...(raw.dailymotion === true ? { dailymotion: true } : {}),
  };
}

/** Une réponse 200 est-elle bien celle de la préparation ? Lecture défensive : un aperçu illisible est ignoré. */
export function readTrailerPreviewWarmResponse(value: unknown): TrailerPreviewWarmResponse | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { ready?: unknown; queued?: unknown };
  if (!Array.isArray(raw.ready)) return null;
  const ready: TrailerPreviewWarmReady[] = [];
  for (const entry of raw.ready) {
    const candidate = entry as { subject?: unknown; preview?: unknown } | null;
    const subject = trailerPreviewWarmSubjectOf(candidate?.subject);
    const preview = candidate?.preview;
    if (subject && isTrailerPreview(preview)) ready.push({ subject, preview });
  }
  return { ready, queued: typeof raw.queued === "number" && Number.isFinite(raw.queued) ? raw.queued : 0 };
}
