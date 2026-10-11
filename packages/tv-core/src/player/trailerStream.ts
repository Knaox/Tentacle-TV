/**
 * Le flux d'une bande-annonce tel que le serveur le résout
 * (`GET /api/trailers/resolve`), lu une fois pour les deux téléviseurs.
 *
 * Le flux « Auto » : `path` posé derrière l'adresse que la TV connaît, sinon
 * `url` (serveur d'avant le relais). Avec la capacité `trailers.player`, le
 * serveur ajoute `qualities` (un maître réduit par hauteur) et `subtitles`
 * (les pistes de YouTube, relayées en WebVTT). Absents, illisibles ou
 * étrangers au relais : listes vides — un serveur d'avant n'offre ni qualité
 * ni sous-titres, sans la moindre erreur.
 */

export interface TrailerQualityTrack {
  /** Hauteur en pixels (1080, 720…). */
  height: number;
  /** Chemin relayé du maître réduit à cette hauteur. */
  path: string;
}

export interface TrailerSubtitleTrack {
  /** Code de langue de YouTube (`fr`, `en-US`) — unique dans la liste : c'est l'identifiant de la piste. */
  lang: string;
  /** Le nom que YouTube lui donne (en anglais). */
  label: string;
  /** Reconnaissance vocale de YouTube. */
  auto: boolean;
  /** Chemin relayé du WebVTT. */
  path: string;
}

export interface TrailerTracks {
  qualities: TrailerQualityTrack[];
  subtitles: TrailerSubtitleTrack[];
}

export interface TrailerStream extends TrailerTracks {
  /** Le flux « Auto », en absolu. */
  url: string;
  /** `m3u8` pour un maître HLS : une URL sans extension reconnue ne dirait rien au lecteur. */
  type?: "m3u8";
}

const HLS_MIME = "application/vnd.apple.mpegurl";
/** Un chemin relayé par CE serveur, jamais une adresse ailleurs. */
const RELAY_PATH = /^\/api\/trailers\/[\w./?=&%-]+$/;
const MAX_QUALITIES = 8;
const MAX_SUBTITLES = 12;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const relayPath = (value: unknown): value is string => typeof value === "string" && RELAY_PATH.test(value);

function readQualities(value: unknown): TrailerQualityTrack[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const out: TrailerQualityTrack[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !relayPath(entry.path)) continue;
    const height = entry.height;
    if (typeof height !== "number" || !Number.isInteger(height) || height <= 0 || height > 4320 || seen.has(height)) continue;
    seen.add(height);
    out.push({ height, path: entry.path });
  }
  return out.sort((a, b) => b.height - a.height).slice(0, MAX_QUALITIES);
}

function readSubtitles(value: unknown): TrailerSubtitleTrack[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: TrailerSubtitleTrack[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !relayPath(entry.path)) continue;
    const { lang, label } = entry;
    if (typeof lang !== "string" || !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,2}$/.test(lang) || seen.has(lang)) continue;
    seen.add(lang);
    out.push({ lang, label: typeof label === "string" && label ? label : lang, auto: entry.auto === true, path: entry.path });
  }
  return out.slice(0, MAX_SUBTITLES);
}

/** La réponse de `resolve` → le flux et ses pistes ; `null` sans flux lisible. */
export function parseTrailerResolve(body: unknown, serverUrl: string): TrailerStream | null {
  if (!isRecord(body)) return null;
  const url = typeof body.path === "string" && body.path.startsWith("/") ? `${serverUrl}${body.path}` : body.url;
  if (typeof url !== "string" || !url.startsWith("http")) return null;
  return {
    url,
    type: body.mimeType === HLS_MIME ? "m3u8" : undefined,
    qualities: readQualities(body.qualities),
    subtitles: readSubtitles(body.subtitles),
  };
}

/** L'adresse à lire pour une qualité : celle de sa hauteur, sinon « Auto » (`null`, hauteur inconnue). */
export function trailerQualityUrl(stream: TrailerStream, serverUrl: string, height: number | null): string {
  const track = height === null ? undefined : stream.qualities.find((q) => q.height === height);
  return track ? `${serverUrl}${track.path}` : stream.url;
}

/** L'adresse du WebVTT d'une piste, ou `null` (aucune, ou langue que le flux n'offre pas). */
export function trailerSubtitleUrl(stream: TrailerStream, serverUrl: string, lang: string | null): string | null {
  const track = lang === null ? undefined : stream.subtitles.find((s) => s.lang === lang);
  return track ? `${serverUrl}${track.path}` : null;
}
