/**
 * Octave — les SORTIES IMPORTÉES (lot « sf », 28/10) : des albums et des titres qu'AUCUN catalogue n'a (ni
 * YouTube Music, ni Spotify, ni Apple Music) et que le compte fait entrer lui-même, par le LIEN d'une page
 * (Bandcamp) ou par ses FICHIERS audio. Contrat entre l'extension (Sillon) et les clients ; le cœur ne fait que
 * relayer (`/api/plugins/<id>/…`, corps en flux, 32 Mo par requête au plus) et lire le manifeste.
 *
 * Point d'extension : `music.releases` (un chemin de BASE) + `music.releaseSources` (ce que l'extension sait
 * importer). Absents, ou liste vide : aucune entrée « Importer », sans erreur — jamais une version lue.
 *
 *   POST   <releases>/link            { url }                       → 202 ReleaseImportJob
 *   POST   <releases>/files           ReleaseFilesRequest           → 202 ReleaseImportJob (un job pour le LOT)
 *   PUT    <releases>/files/<upload>?offset=<n>   octets (≤ chunkBytes) → ReleaseUploadProgress
 *   GET    <releases>/files/<upload>                                → ReleaseUploadProgress (reprise)
 *   GET    <releases>/jobs/<jobId>                                  → ReleaseImportJob
 *   DELETE <releases>/jobs/<jobId>                                  → 204 (annule ce qui n'est pas lu)
 *   GET    <releases>                                               → ReleasesResponse (les imports du compte)
 *   DELETE <releases>/<externalId>                                  → 204 (un album ou un titre importé)
 *
 * Un album, un titre ou un artiste importé s'ouvre, se lit, s'aime, s'ajoute à une playlist et se garde hors
 * ligne par les points ORDINAIRES (`album`, `artist`, `resolve`, `like`, `playlistAdd`, `offline`) : ses
 * identifiants sont opaques comme les autres. Il est au SEUL compte qui l'a importé.
 */

import type { MusicAlbum, MusicArtist } from "./musicTypes";

/** Liste FERMÉE : ce que l'extension sait importer (`music.releaseSources`). */
export type ReleaseSource = "bandcamp" | "files";
export const RELEASE_SOURCES: readonly ReleaseSource[] = ["bandcamp", "files"];

/** Les extensions de fichiers que le sélecteur propose (le serveur juge sur le CONTENU, jamais sur le nom). */
export const RELEASE_FILE_EXTENSIONS: readonly string[] = ["mp3", "m4a", "aac", "flac", "ogg", "oga", "opus", "wav", "aif", "aiff", "zip"];
export const RELEASE_FILE_MIME_TYPES: readonly string[] = [
  "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/flac", "audio/x-flac", "audio/ogg", "audio/opus", "audio/wav", "audio/x-wav", "audio/wave",
  "audio/aiff", "audio/x-aiff", "application/zip", "application/x-zip-compressed",
];

/**
 * Le ZIP d'un téléchargement Bandcamp (tous ses formats : MP3 V0 / 320, FLAC, AAC, Ogg Vorbis, ALAC, WAV, AIFF) s'envoie
 * TEL QUEL comme un fichier du lot : le serveur l'ouvre, chaque piste et image y entre comme si elle avait été envoyée,
 * et le fichier ZIP finit `read` (ou `refused` s'il n'en sort rien). Le même album dans un autre format reste UN album :
 * la meilleure qualité est gardée (sans perte, puis profondeur, puis débit).
 */
export const RELEASE_ARCHIVE_EXTENSIONS: readonly string[] = ["zip"];

/**
 * Une IMAGE envoyée dans un lot (le `cover.png` d'un téléchargement Bandcamp, un `folder.jpg`) : la pochette des albums
 * du lot quand elle est plus GRANDE que la leur (25 Mo au plus) ; le fichier finit `read`, sans `trackId`. Le sélecteur
 * peut donc proposer ces extensions avec les fichiers audio.
 */
export const RELEASE_COVER_EXTENSIONS: readonly string[] = ["jpg", "jpeg", "png", "webp"];
export const RELEASE_COVER_MIME_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];

/** Au plus par lot (une requête `files`) ; au-delà : 400 `tooMany`. */
export const RELEASE_FILES_PER_JOB = 100;

/** Liste FERMÉE des refus (le client a ses mots pour chacun) ; une valeur inconnue se lit `failed`. */
export type ReleaseRefusal =
  /** Lien d'un site que l'extension ne lit pas, ou d'une page qui n'est ni un album ni un titre. */
  | "unsupported"
  /** La page n'existe pas (404) ou ne décrit aucune piste. */
  | "notFound"
  /** La source ne répond pas (panne, coupure) : réessayer plus tard. */
  | "unavailable"
  /** La cadence de la source est atteinte : réessayer dans `retryAfterMs`. */
  | "budget"
  /** Le compte n'a pas le droit (invité de la Famille, session d'appareil, droit d'usage). */
  | "forbidden"
  /** Fichier plus grand que la borne d'un fichier (`RELEASE_FILE_MAX_BYTES`). */
  | "tooLarge"
  /** La place du compte est pleine (`RELEASE_ACCOUNT_MAX_BYTES`). */
  | "quota"
  /** Trop de fichiers dans un lot. */
  | "tooMany"
  /** Le contenu n'est pas un fichier audio lisible (MP3, M4A/AAC, FLAC, OGG/Opus, WAV). */
  | "unsupportedFormat"
  /** Le fichier est audio mais illisible (tronqué, abîmé). */
  | "unreadable"
  /** L'envoi a expiré (24 h sans morceau) : recommencer le fichier. */
  | "expired"
  | "failed";

/** Un fichier : 1 Go ; un compte : 20 Go (en octets). */
export const RELEASE_FILE_MAX_BYTES = 1024 * 1024 * 1024;
export const RELEASE_ACCOUNT_MAX_BYTES = 20 * 1024 * 1024 * 1024;

/** Corps d'un refus HTTP (4xx/5xx) des routes `releases`. */
export interface ReleaseErrorBody {
  error: ReleaseRefusal;
  /** `budget` : quand réessayer. */
  retryAfterMs?: number;
  /** PUT à un mauvais `offset` (409) : ce que le serveur a déjà ; le client reprend de là. */
  received?: number;
}

export interface ReleaseLinkRequest {
  /** https://<artiste>.bandcamp.com/album/… ou …/track/… (ou un domaine propre servi par Bandcamp). */
  url: string;
}

export interface ReleaseFilesRequest {
  /** 1 à `RELEASE_FILES_PER_JOB` fichiers ; `type` : le type MIME connu de l'appareil, ou "". */
  files: { name: string; size: number; type: string }[];
  /**
   * Nom d'album à donner aux fichiers du lot qui n'en ont PAS dans leurs tags (le nom du dossier, par exemple).
   * Absent : les fichiers sans tag d'album du lot forment UN album « Importés » de leur artiste.
   */
  albumHint?: string;
}

export type ReleaseFileState =
  /** Rien reçu encore. */
  | "waiting"
  | "receiving"
  /** Reçu et lu : il est dans un album. */
  | "read"
  /** Le MÊME contenu était déjà importé par ce compte : rien de nouveau (son titre reste le même). */
  | "duplicate"
  | "refused";

export interface ReleaseJobFile {
  uploadId: string;
  name: string;
  size: number;
  received: number;
  state: ReleaseFileState;
  refusal?: ReleaseRefusal;
  /** Le titre créé (ou retrouvé pour `duplicate`) : identifiant externe, ouvrable par le point `album` de son album. */
  trackId?: string;
}

export interface ReleaseImportJob {
  jobId: string;
  source: ReleaseSource;
  /** `receiving` : des fichiers attendent leurs octets ; `reading` : lecture (tags, page) ; puis `done` / `failed`. */
  state: "receiving" | "reading" | "done" | "failed";
  /** Pour `files` : un par fichier, dans l'ordre de la demande. */
  files?: ReleaseJobFile[];
  /** Taille d'un morceau d'envoi (octets) : chaque PUT en porte au plus autant (8 Mo aujourd'hui). */
  chunkBytes?: number;
  /** Les albums créés ou complétés par ce job (sans `tracks`) : un lot peut en faire plusieurs. */
  albums: MusicAlbum[];
  /** Où aller une fois fini : l'album (et le titre, pour le lien d'un titre) — identifiants externes. */
  focus: { albumId: string; trackId: string | null } | null;
  refusal?: ReleaseRefusal;
  retryAfterMs?: number;
  createdAt: number;
  updatedAt: number;
}

export type ReleaseUploadProgress =
  | { uploadId: string; size: number; received: number; done: false }
  /** Le dernier morceau reçu : le fichier est lu ; `job` dit où il est rangé. */
  | { uploadId: string; size: number; received: number; done: true; job: ReleaseImportJob };

/** Les imports du compte (rangée « Importés ») : du plus récent au plus ancien, sans `tracks` ni `albums`. */
export interface ReleasesResponse {
  albums: MusicAlbum[];
  artists: MusicArtist[];
}

/** Les tailles d'une pochette importée : remplacer le DERNIER segment de `artworkUrl` / `imageUrl`. */
export type ReleaseArtSize = "300" | "700" | "1200" | "full";
export const RELEASE_ART_SIZES: readonly ReleaseArtSize[] = ["300", "700", "1200", "full"];

/**
 * L'URL d'une pochette importée à une autre taille : `…/music/releases/art/<id>/<taille>` (servie de l'extension,
 * jamais plus grande que la source). Toute autre URL est rendue telle quelle.
 */
export function releaseArtSized(url: string, size: ReleaseArtSize): string {
  return /\/music\/releases\/art\/[A-Za-z0-9_-]+\/(?:300|700|1200|full)$/.test(url) ? url.replace(/[^/]+$/, size) : url;
}

/** Un lien de sortie reconnu SANS réseau (partage système, collage) ; `null` : pas un lien Bandcamp connu. */
export interface RecognizedReleaseUrl {
  source: "bandcamp";
  kind: "album" | "track";
  /** Le lien canonique (https, sans requête ni fragment) à envoyer à `<releases>/link`. */
  url: string;
}

const BANDCAMP_PATH = /^\/(album|track)\/([a-z0-9][a-z0-9-]{0,199})\/?$/i;

/**
 * Le premier lien Bandcamp d'un texte partagé (« Écoutez … https://x.bandcamp.com/album/y?from=… »). Un domaine
 * PROPRE d'artiste servi par Bandcamp n'est pas reconnaissable sans réseau : le client peut tout de même l'envoyer
 * (collage explicite), l'extension répond `unsupported` si la page n'est pas une page Bandcamp.
 */
export function recognizeReleaseUrl(text: string): RecognizedReleaseUrl | null {
  for (const raw of text.match(/https?:\/\/[^\s<>"']+/gi) ?? []) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    const host = parsed.hostname.toLowerCase();
    if (host !== "bandcamp.com" && !host.endsWith(".bandcamp.com")) continue;
    const path = BANDCAMP_PATH.exec(parsed.pathname);
    if (!path) continue;
    return { source: "bandcamp", kind: path[1].toLowerCase() as "album" | "track", url: `https://${host}/${path[1].toLowerCase()}/${path[2]}` };
  }
  return null;
}
