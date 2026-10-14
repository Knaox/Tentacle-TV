/**
 * L'APERÇU d'une bande-annonce au survol d'une carte — le contrat de
 * `GET /api/trailers/preview`, que le serveur déclare par la capacité
 * `trailers.preview`.
 *
 * Le client fait UN appel ; le serveur choisit la bande-annonce (Jellyfin et
 * TMDB, la langue demandée d'abord — la VF en français —, une vraie
 * bande-annonce avant un teaser, jamais une featurette), la VÉRIFIE
 * (extraction, maître et premières listes lus chez YouTube) et rend un flux
 * RELAYÉ par lui (`/api/trailers/hls/…`, `/api/trailers/file/…`) : aucune
 * URL YouTube, aucune erreur à découvrir en cours de lecture. Tout refus veut
 * dire « rien à montrer » : aucune transition, aucun message.
 *
 * MIROIR : recopié octet pour octet dans `apps/backend/src/trailers/` (le
 * backend ne dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker
 * sans packages/). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/trailers/trailerPreview.ts apps/backend/src/trailers/
 *
 * `trailersMirror.test.ts` (backend) refuse toute divergence. Aucun import :
 * le fichier compile seul des deux côtés.
 */

/** La route, préfixe compris. */
export const TRAILER_PREVIEW_ROUTE = "/api/trailers/preview";

export type TrailerPreviewMediaType = "movie" | "tv";

/** Un titre de la bibliothèque : film ou série — un épisode ou une saison valent leur SÉRIE. */
export interface TrailerPreviewItemTarget {
  itemId: string;
}

/** Un titre hors bibliothèque (carte TMDB, Vigie) : son identifiant TMDB et son type. */
export interface TrailerPreviewTmdbTarget {
  tmdbId: number | string;
  mediaType: TrailerPreviewMediaType;
}

/**
 * La demande : UN titre, et la langue de l'interface (`fr`, `en`…) qui ordonne
 * les bandes-annonces — la VF d'abord en français. Sans langue, l'ordre des
 * types seul (bande-annonce, puis teaser).
 */
export type TrailerPreviewRequest = (TrailerPreviewItemTarget | TrailerPreviewTmdbTarget) & { lang?: string };

export const TRAILER_PREVIEW_HLS_MIME = "application/vnd.apple.mpegurl";
export const TRAILER_PREVIEW_MP4_MIME = "video/mp4";
export type TrailerPreviewMimeType = typeof TRAILER_PREVIEW_HLS_MIME | typeof TRAILER_PREVIEW_MP4_MIME;

/** Une qualité imposée : le maître réduit à une hauteur (même jeton que `path`). */
export interface TrailerPreviewQuality {
  height: number;
  path: string;
}

/** 200 — une bande-annonce vérifiée, prête à lire. */
export interface TrailerPreview {
  /** La vidéo YouTube retenue (11 caractères) — une clé, jamais une adresse à ouvrir. */
  ytId: string;
  /**
   * Le flux relayé par CE serveur, jeton compris, à poser derrière son
   * adresse : un maître HLS (`mimeType` HLS — hls.js, AVPlayer) qui part de la
   * 720p puis s'adapte jusqu'en 1080p ; à défaut de HLS (vidéo « pour
   * enfants »), un MP4 lu par plages (`<video>`).
   */
  path: string;
  mimeType: TrailerPreviewMimeType;
  /** Au-delà (ms depuis l'époque), `path` ne s'ouvre plus : redemander l'aperçu. */
  expiresAt: number;
  /** Les hauteurs H.264 du maître, de la plus haute à la plus basse ; vide pour un MP4. */
  heights: number[];
  /** Un maître RÉDUIT à chaque hauteur, la meilleure en tête ; vide pour un MP4. */
  qualities: TrailerPreviewQuality[];
}

/**
 * Les refus — chacun veut dire « rien à montrer » :
 * - 400 `invalid_request` : ni `itemId`, ni `tmdbId` + `mediaType` lisibles ;
 * - 404 `no_trailer` : aucune bande-annonce YouTube — ou un titre que ce compte
 *   ne voit pas, ou qui n'en a pas par nature (collection, personne, musique) ;
 * - 404 `unavailable` : il y en a, aucune ne se laisse lire en ce moment ;
 * - 429 `rate_limited` : trop d'aperçus demandés d'affilée, ou le serveur en
 *   prépare déjà trop — l'en-tête `Retry-After` dit dans combien de secondes.
 */
export type TrailerPreviewRefusal = "invalid_request" | "no_trailer" | "unavailable" | "rate_limited";

export interface TrailerPreviewRefusalBody {
  error: TrailerPreviewRefusal;
  /**
   * 429 seulement : dans combien de secondes redemander — la valeur de
   * `Retry-After`, recopiée dans le corps pour un client qui ne lit pas
   * l'en-tête. Additif : un serveur d'avant ne l'envoie pas.
   */
  retryAfterS?: number;
}

/**
 * Combien de temps un refus vaut — le serveur garde sa décision autant, un
 * client peut s'en souvenir autant sans redemander : aucune bande-annonce, une
 * heure ; aucune lisible, dix minutes. Une décision « aucune lisible » a coûté
 * jusqu'à trois extractions YouTube : la reprendre chaque minute, c'était les
 * recommencer à chaque survol du titre. Un blocage de YouTube n'en est pas
 * une (le disjoncteur du serveur suspend tous les aperçus, rien n'est retenu
 * par titre).
 */
export const TRAILER_PREVIEW_NO_TRAILER_TTL_MS = 60 * 60 * 1000;
export const TRAILER_PREVIEW_UNAVAILABLE_TTL_MS = 10 * 60 * 1000;

const ITEM_ID_RE = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const TMDB_ID_RE = /^[1-9]\d{0,9}$/;
const LANG_RE = /^([a-zA-Z]{2,3})(?:[-_][a-zA-Z0-9]{1,8})*$/;
const YT_ID_RE = /^[\w-]{11}$/;

/** L'identifiant Jellyfin d'un titre, sous sa forme courte (32 hexadécimaux, minuscules) ; `null` s'il est illisible. */
export function previewItemIdOf(value: unknown): string | null {
  return typeof value === "string" && ITEM_ID_RE.test(value) ? value.replace(/-/g, "").toLowerCase() : null;
}

/** L'identifiant TMDB d'un titre (entier positif), qu'il vienne en nombre ou en texte ; `null` s'il est illisible. */
export function previewTmdbIdOf(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : value;
  return typeof text === "string" && TMDB_ID_RE.test(text) ? Number(text) : null;
}

/** La langue retenue : sa langue principale, en minuscules (`fr-CA` → `fr`) ; `undefined` sans langue lisible. */
export function previewLangOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return LANG_RE.exec(value)?.[1]?.toLowerCase();
}

function mediaTypeOf(value: unknown): TrailerPreviewMediaType | null {
  return value === "movie" || value === "tv" ? value : null;
}

/** Le paramètre d'une requête, s'il n'y figure qu'une fois. */
function single(value: unknown): unknown {
  return Array.isArray(value) ? undefined : value;
}

/**
 * La demande que porte une requête — le serveur la lit avec les MÊMES règles
 * que `trailerPreviewPath` l'écrit. `null` : illisible (aucun titre, deux
 * titres à la fois, un identifiant mal formé). La langue illisible est
 * simplement omise.
 */
export function parseTrailerPreviewQuery(query: Readonly<Record<string, unknown>>): TrailerPreviewRequest | null {
  const rawItem = single(query.itemId);
  const rawTmdb = single(query.tmdbId);
  const lang = previewLangOf(single(query.lang));
  const withLang = <T extends object>(target: T) => (lang ? { ...target, lang } : target);
  if (rawItem !== undefined && rawItem !== "") {
    if (rawTmdb !== undefined || query.mediaType !== undefined) return null;
    const itemId = previewItemIdOf(rawItem);
    return itemId ? withLang({ itemId }) : null;
  }
  const tmdbId = previewTmdbIdOf(rawTmdb);
  const mediaType = mediaTypeOf(single(query.mediaType));
  return tmdbId !== null && mediaType ? withLang({ tmdbId, mediaType }) : null;
}

/**
 * Le chemin de la demande (`/api/trailers/preview?…`), à poser derrière
 * l'adresse du serveur ; `null` pour une demande illisible — rien à demander.
 */
export function trailerPreviewPath(request: TrailerPreviewRequest): string | null {
  const lang = previewLangOf(request.lang);
  const params: string[] = [];
  if ("itemId" in request) {
    const itemId = previewItemIdOf(request.itemId);
    if (!itemId) return null;
    params.push(`itemId=${itemId}`);
  } else {
    const tmdbId = previewTmdbIdOf(request.tmdbId);
    const mediaType = mediaTypeOf(request.mediaType);
    if (tmdbId === null || !mediaType) return null;
    params.push(`tmdbId=${tmdbId}`, `mediaType=${mediaType}`);
  }
  if (lang) params.push(`lang=${encodeURIComponent(lang)}`);
  return `${TRAILER_PREVIEW_ROUTE}?${params.join("&")}`;
}

/** Une réponse 200 est-elle bien un aperçu lisible ? Lecture défensive : un champ manquant vaut « rien à montrer ». */
export function isTrailerPreview(value: unknown): value is TrailerPreview {
  if (!value || typeof value !== "object") return false;
  const preview = value as Partial<TrailerPreview>;
  return typeof preview.ytId === "string" && YT_ID_RE.test(preview.ytId)
    && typeof preview.path === "string" && preview.path.startsWith("/api/trailers/")
    && (preview.mimeType === TRAILER_PREVIEW_HLS_MIME || preview.mimeType === TRAILER_PREVIEW_MP4_MIME)
    && typeof preview.expiresAt === "number" && Number.isFinite(preview.expiresAt)
    && Array.isArray(preview.heights) && Array.isArray(preview.qualities);
}
