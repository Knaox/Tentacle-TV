/**
 * Octave — l'IMPORT d'une playlist d'un autre service (Spotify, Apple Music,
 * Deezer, YouTube Music, ou une liste collée). Contrat commun au cœur
 * (`POST /api/music/import`, capacité `music.playlistImport`) et aux
 * extensions (points optionnels `importRead` / `importTracks` du contrat
 * `music`, pluginMusicContract.ts). Recopié octet pour octet dans le backend
 * (`apps/backend/src/music/contract/`, test miroir).
 *
 * Le cœur lit Spotify, Apple Music, Deezer et le texte ; il rapproche chaque
 * titre de la bibliothèque par LA règle (`musicLibraryMatch.ts`) et crée la
 * playlist Jellyfin au nom du compte avec les SEULS titres de la bibliothèque.
 * Les absents ne vont qu'à une extension qui déclare `importTracks` ; sans
 * elle, ils sont listés, jamais ajoutés. Une source que le cœur ne lit pas
 * (YouTube) passe par `importRead` d'une extension, ou n'est pas offerte.
 */

import type { ImportSkipped } from "./musicImportSkip";

/**
 * Sources d'import, liste FERMÉE (les clés traversent le réseau : jamais renommées). `tentacle` : le lien de
 * partage d'une playlist d'un AUTRE serveur Tentacle (`musicShare.ts`, capacité `music.playlistShare`).
 */
export type MusicImportSource = "spotify" | "apple" | "deezer" | "youtube" | "text" | "tentacle";
export const MUSIC_IMPORT_SOURCES: readonly MusicImportSource[] = ["spotify", "apple", "deezer", "youtube", "text", "tentacle"];

/** Les sources que le CŒUR sait lire seul (un lien) ; le texte passe par `text`. */
export const CORE_IMPORT_SOURCES: readonly MusicImportSource[] = ["spotify", "apple", "deezer"];

/** Le cœur lit-il ce lien lui-même ? Un lien Tentacle aussi, quand le serveur déclare `music.playlistShare`. */
export function coreReadsImport(source: MusicImportSource, tentacleShare: boolean): boolean {
  return CORE_IMPORT_SOURCES.includes(source) || (source === "tentacle" && tentacleShare);
}

/**
 * La source dite à une EXTENSION (`importTracks`) : une extension d'avant `tentacle` refuserait la requête
 * entière ; pour elle, un partage Tentacle est ce qu'est une liste collée — titre, artistes, album.
 */
export function extensionImportSource(source: MusicImportSource): MusicImportSource {
  return source === "tentacle" ? "text" : source;
}

export const MUSIC_IMPORT_LIMITS = {
  /** Titres lus au plus ; au-delà la lecture s'arrête (`truncated`). */
  tracks: 1_000,
  /** Texte collé (liste ou CSV), en caractères. */
  text: 512_000,
  /** Un champ de titre, d'artiste, d'album. */
  field: 300,
  /** Artistes gardés par titre. */
  artists: 12,
  /** Longueur d'un lien. */
  url: 2_048,
} as const;

/** Un titre d'une playlist importée, tel que la SOURCE le dit (normalisé). */
export interface ImportedTrack {
  /** Rang dans la playlist source (0, 1, 2…) : l'identité du titre pendant tout l'import. */
  index: number;
  title: string;
  /** Les artistes, un nom par entrée (déjà découpés quand la source le permet). */
  artists: string[];
  album: string | null;
  durationMs: number | null;
  /** Code ISRC (12 caractères, majuscules) si la source le donne. */
  isrc: string | null;
  /** L'identifiant du titre CHEZ la source (information, jamais une clé du cœur). */
  sourceId: string | null;
  /** La source ne le joue pas (1.40.0) : `region` (Deezer `readable: false`), `refused` (Spotify `isPlayable: false`). */
  sourceBlocked?: "region" | "refused";
}

/** Une playlist lue (par le cœur ou par `importRead` d'une extension). */
export interface ImportedPlaylist {
  source: MusicImportSource;
  name: string;
  tracks: ImportedTrack[];
  /** La source en compte plus que ce qui a pu être lu (page publique bornée, plafond atteint). */
  truncated: boolean;
  artworkUrl: string | null;
}

/** Un absent confié à l'extension : le titre et sa place dans la playlist Jellyfin créée. */
export interface ImportAbsentTrack extends ImportedTrack {
  /**
   * La sémantique EXACTE de `playlistAdd.position` (et de `mergePlaylist`) : l'index, dans la liste des SEULES
   * entrées Jellyfin, avant lequel il se range. Plusieurs absents à la même place : l'ordre de `index`.
   */
  position: number;
}

/* ── Les liens reconnus (liste FERMÉE d'hôtes : rien d'autre n'est jamais lu) ── */

export type ImportUrlKind = "playlist" | "album" | "short";

export interface RecognizedImportUrl {
  source: Exclude<MusicImportSource, "text">;
  kind: ImportUrlKind;
  /** L'identifiant chez la source (pour `short` : le chemin court, résolu par le serveur ; `tentacle` : le jeton). */
  id: string;
  /** Le lien canonique, sur un hôte de la liste fermée (`tentacle` : le serveur qui partage, lu par sa seule route publique). */
  url: string;
}

/** Le chemin d'un lien de partage de playlist Tentacle : `<serveur>/octave/share/<jeton>`. */
export const TENTACLE_SHARE_PATH = "/octave/share/";
/** Le jeton d'un lien de partage : 16 octets tirés au hasard, en base64url (22 caractères). */
export const TENTACLE_SHARE_TOKEN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Un lien de partage d'une playlist Tentacle (`https://serveur[:port][/préfixe]/octave/share/<jeton>`), d'un
 * serveur quelconque — `null` sinon. Le lien canonique garde l'origine et le préfixe, jamais la requête.
 */
export function recognizeTentacleShare(input: string): RecognizedImportUrl | null {
  const url = parsed(input);
  if (!url || url.username !== "" || url.password !== "") return null;
  const at = url.pathname.lastIndexOf(TENTACLE_SHARE_PATH);
  if (at < 0) return null;
  const token = url.pathname.slice(at + TENTACLE_SHARE_PATH.length).replace(/\/$/, "");
  if (!TENTACLE_SHARE_TOKEN.test(token)) return null;
  const prefix = url.pathname.slice(0, at);
  return { source: "tentacle", kind: "playlist", id: token, url: `${url.origin}${prefix}${TENTACLE_SHARE_PATH}${token}` };
}

const ID = {
  spotify: /^[A-Za-z0-9]{10,40}$/,
  apple: /^(?:pl\.[A-Za-z0-9-]{8,64}|\d{3,20})$/,
  deezer: /^\d{1,20}$/,
  youtube: /^[A-Za-z0-9_-]{10,64}$/,
  short: /^[A-Za-z0-9_-]{3,64}$/,
} as const;

/** Les hôtes courts qui ne font que REDIRIGER vers un hôte de la liste (le serveur suit, hôte par hôte). */
export const IMPORT_SHORT_HOSTS: Readonly<Record<string, Exclude<MusicImportSource, "text">>> = {
  "spotify.link": "spotify",
  "link.deezer.com": "deezer",
  "deezer.page.link": "deezer",
};

function parsed(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function spotifyOf(input: string, url: URL | null): RecognizedImportUrl | null {
  const uri = input.trim().match(/^spotify:(playlist|album):([A-Za-z0-9]+)$/);
  const parts = url && url.hostname === "open.spotify.com" ? url.pathname.split("/").filter(Boolean).filter((p) => !/^intl-[a-z-]+$/i.test(p) && p !== "embed") : [];
  const kind = uri?.[1] ?? parts[0];
  const id = uri?.[2] ?? parts[1];
  if ((kind !== "playlist" && kind !== "album") || !id || !ID.spotify.test(id)) return null;
  return { source: "spotify", kind, id, url: `https://open.spotify.com/${kind}/${id}` };
}

function appleOf(url: URL): RecognizedImportUrl | null {
  if (url.hostname !== "music.apple.com" && url.hostname !== "embed.music.apple.com") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const at = parts.findIndex((p) => p === "playlist" || p === "album");
  const kind = parts[at] as "playlist" | "album" | undefined;
  const id = parts[parts.length - 1];
  const storefront = /^[a-z]{2}$/.test(parts[0] ?? "") ? parts[0] : "us";
  if (at < 0 || !kind || !id || !ID.apple.test(id) || (kind === "playlist") !== id.startsWith("pl.")) return null;
  return { source: "apple", kind, id, url: `https://music.apple.com/${storefront}/${kind}/${parts.length - at > 2 ? `${parts[at + 1]}/` : ""}${id}` };
}

function deezerOf(url: URL): RecognizedImportUrl | null {
  if (url.hostname !== "www.deezer.com" && url.hostname !== "deezer.com") return null;
  const parts = url.pathname.split("/").filter(Boolean).filter((p) => !/^[a-z]{2}(?:-[a-z]{2})?$/i.test(p));
  const kind = parts[0];
  const id = parts[1];
  if ((kind !== "playlist" && kind !== "album") || !id || !ID.deezer.test(id)) return null;
  return { source: "deezer", kind, id, url: `https://www.deezer.com/${kind}/${id}` };
}

function youtubeOf(url: URL): RecognizedImportUrl | null {
  if (!["music.youtube.com", "www.youtube.com", "youtube.com", "m.youtube.com"].includes(url.hostname)) return null;
  const browse = url.pathname.match(/^\/browse\/VL([A-Za-z0-9_-]+)$/)?.[1];
  const id = url.searchParams.get("list") ?? browse;
  if (!id || !ID.youtube.test(id)) return null;
  return { source: "youtube", kind: "playlist", id, url: `https://music.youtube.com/playlist?list=${id}` };
}

/** Un lien collé : sa source et l'identifiant de la playlist (ou de l'album) — `null` s'il n'est pas reconnu. */
export function recognizeImportUrl(input: string): RecognizedImportUrl | null {
  if (input.length > MUSIC_IMPORT_LIMITS.url) return null;
  const url = parsed(input);
  const spotify = spotifyOf(input, url);
  if (spotify || !url) return spotify;
  const short = IMPORT_SHORT_HOSTS[url.hostname];
  if (short) {
    const code = url.pathname.split("/").filter(Boolean).pop() ?? "";
    return ID.short.test(code) ? { source: short, kind: "short", id: code, url: `https://${url.hostname}${url.pathname}` } : null;
  }
  return appleOf(url) ?? deezerOf(url) ?? youtubeOf(url) ?? recognizeTentacleShare(input);
}

/** La place de chaque absent (sémantique de `playlistAdd.position`) : le nombre de présents qui le précèdent. */
export function absentPositions(total: number, found: ReadonlySet<number>): Map<number, number> {
  const out = new Map<number, number>();
  let present = 0;
  for (let index = 0; index < total; index += 1) {
    if (found.has(index)) present += 1;
    else out.set(index, present);
  }
  return out;
}

/* ── Le cœur : `POST /api/music/import`, suivi `GET /api/music/import/:jobId` ── */

export const MUSIC_IMPORT_ROUTES = {
  /** POST `MusicImportRequest` → 202 `{ jobId }` (capacité `music.playlistImport`). */
  start: "/api/music/import",
  /** GET → `MusicImportJob` (sondage court : seul le compte qui l'a lancé le lit). */
  job: "/api/music/import/:jobId",
} as const;

export type MusicImportRequest =
  /** Un lien d'une source que le cœur lit (Spotify, Apple Music, Deezer). */
  | { url: string; name?: string; keepEmpty?: boolean }
  /** Une liste collée : une ligne « Artiste - Titre », ou un CSV avec en-tête (export d'un autre service). */
  | { text: string; name?: string; keepEmpty?: boolean }
  /** Une playlist DÉJÀ lue par une extension (`importRead`) : le cœur ne fait que rapprocher et créer. */
  | { playlist: ImportedPlaylist; name?: string; keepEmpty?: boolean };

/** Liste FERMÉE : le client a ses mots pour chacune. */
export type MusicImportFailure =
  /** Le lien n'est pas d'une source que le cœur lit. */
  | "unsupported"
  /** La playlist n'existe pas (ou plus). */
  | "notFound"
  /** Elle est privée : seul son propriétaire la voit. */
  | "private"
  /** La source ne répond pas, ou a changé de forme. */
  | "unavailable"
  /** Rien de lisible (texte vide, playlist vide). */
  | "empty"
  /** Aucun titre de la bibliothèque, et rien à confier à une extension : aucune playlist créée. */
  | "noneInLibrary"
  /** Jellyfin a refusé la playlist. */
  | "failed";

export type MusicImportStage = "reading" | "matching" | "creating" | "done" | "failed";

export interface MusicImportResult {
  playlistId: string;
  name: string;
  source: MusicImportSource;
  /** Titres lus à la source. */
  total: number;
  /** Titres de la bibliothèque entrés dans la playlist. */
  added: number;
  /** Les absents, dans l'ordre de la source, avec leur place (à confier à une extension, ou à lister). */
  absent: ImportAbsentTrack[];
  truncated: boolean;
}

export interface MusicImportJob {
  jobId: string;
  stage: MusicImportStage;
  source: MusicImportSource | null;
  /** Le nom lu à la source, dès qu'il est connu. */
  name: string | null;
  total: number;
  /** Titres déjà confrontés à la bibliothèque. */
  matched: number;
  /** Parmi eux, ceux que la bibliothèque a. */
  found: number;
  failure?: MusicImportFailure;
  result?: MusicImportResult;
}

/* ── L'extension (points optionnels `importRead`, `importTracks` du contrat `music`) ── */

/** Refus de `importRead`, liste FERMÉE (le client les dit comme ceux du cœur). */
export type ImportReadRefusal = "unsupported" | "notFound" | "private" | "unavailable" | "tooLarge" | "budget";

/** POST `<importTracks>` — les absents d'un import, pour la playlist que le cœur vient de créer au nom du compte. */
export interface ImportTracksRequest {
  playlistId: string;
  source: MusicImportSource;
  tracks: ImportAbsentTrack[];
}

/** 202 — l'opération suivie ; `accepted` ≤ le nombre confié (elle peut en refuser d'emblée, quota). */
export interface ImportTracksAccepted {
  operationId: string;
  accepted: number;
}

/** GET `<importTracks>/<operationId>` — sondé tant que `running`. */
export interface ImportTracksProgress {
  operationId: string;
  state: "running" | "done" | "failed";
  total: number;
  /** Titres traités (trouvés + introuvables). */
  processed: number;
  /** Titres ENTRÉS dans la playlist (entrées `playlistAdd` en attente, jouables aussitôt). */
  added: number;
  /** Les `index` qu'elle n'a pas trouvés. */
  notFound: number[];
  /** Raison d'un `failed` ou d'un arrêt partiel (liste fermée `ExternalActionRefusal` du contrat `music`). */
  reason?: "quota" | "forbidden" | "unavailable" | "notFound" | "failed";
  /** Les titres non posés et leur motif (1.40.0 ; une extension d'avant : `notFound` seul). */
  skipped?: ImportSkipped[];
  /** Parmi `added`, ceux que le COMPTE avait déjà importés (ses fichiers) : pas « en cloud ». */
  own?: number;
}
