/**
 * Octave — le PARTAGE d'une playlist (capacité `music.playlistShare`, 1.40.0). Contrat commun au cœur et
 * aux clients, recopié octet pour octet dans le backend (`apps/backend/src/music/contract/`, test miroir).
 *
 * Le propriétaire d'un droit « Partage public » (`EnablePublicSharing`, le même que Ma liste) crée UN lien
 * par playlist, non devinable (16 octets au hasard), révocable. Qui a le lien lit les MÉTADONNÉES des titres,
 * rien d'autre : ni fichier, ni flux, ni image, ni jeton, ni identifiant Jellyfin. Un utilisateur d'un AUTRE
 * serveur Tentacle colle le lien dans Octave (ou l'ouvre : la page du lien propose l'import) ; SON serveur
 * lit ce document (source d'import `tentacle`, `musicImport.ts`) et reconnaît chaque titre dans SA
 * bibliothèque, le reste par son extension, comme un import Spotify.
 */

import { MUSIC_IMPORT_LIMITS, recognizeTentacleShare, TENTACLE_SHARE_PATH, TENTACLE_SHARE_TOKEN, type ImportedTrack } from "./musicImport";

export const MUSIC_SHARE_ROUTES = {
  /** GET → `MusicPlaylistShareState` ; POST → crée (ou rend) le lien ; DELETE → le révoque. Au nom du compte. */
  owner: "/api/music/playlists/:id/share",
  /** GET, SANS compte → `SharedMusicPlaylist` (404 `share_unavailable` si révoqué, inconnu ou droit perdu). */
  document: "/api/music/share/:token",
} as const;

export interface MusicPlaylistShare {
  /** Le lien à donner : `<adresse publique du serveur>/octave/share/<jeton>`. */
  url: string;
  token: string;
  createdAt: number;
  /**
   * `public` : sur le lien public du serveur (réglé dans « Accès à distance ») — un autre serveur le lit.
   * `local` : faute de lien public, l'adresse par laquelle CET appareil joint le serveur ; il ne marche qu'à
   * qui la joint aussi (le client le dit, et renvoie vers « Accès à distance » pour un administrateur).
   */
  reach: "public" | "local";
}

export interface MusicPlaylistShareState {
  share: MusicPlaylistShare | null;
}

/** Un titre partagé : ce qu'il faut pour le reconnaître ailleurs, et rien de plus. */
export interface SharedMusicTrack {
  title: string;
  artists: string[];
  album: string | null;
  durationMs: number | null;
  /** L'identifiant MusicBrainz de l'enregistrement, s'il est connu (public, aide la reconnaissance). */
  recording: string | null;
}

/** Le document public d'un lien (version 1). */
export interface SharedMusicPlaylist {
  v: 1;
  name: string;
  description: string | null;
  /** Le nom du compte qui partage (comme Ma liste). */
  ownerName: string;
  /** Titres de la bibliothèque dans la playlist (les attentes hors bibliothèque ne se partagent pas). */
  total: number;
  /** La playlist en compte plus que `tracks` (plafond `MUSIC_IMPORT_LIMITS.tracks`). */
  truncated: boolean;
  tracks: SharedMusicTrack[];
}

/** Refus du propriétaire, liste FERMÉE (le client a ses mots pour chacun). */
export type MusicShareRefusal = "public_sharing_denied" | "not_found" | "unavailable";

/** Le lien d'un partage, sur l'adresse publique du serveur (sans barre finale). */
export function playlistShareUrl(publicOrigin: string, token: string): string {
  // En remontant la chaîne, comme `trimTrailingSlashes` (utils, hors du miroir du backend) : `/\/+$/` y était
  // quadratique sur une longue suite de « / » (js/polynomial-redos).
  let end = publicOrigin.length;
  while (end > 0 && publicOrigin[end - 1] === "/") end -= 1;
  return `${publicOrigin.slice(0, end)}${TENTACLE_SHARE_PATH}${token}`;
}

/** L'adresse du DOCUMENT d'un lien de partage reconnu (même serveur, même préfixe) ; `null` sinon. */
export function sharedDocumentUrl(link: string): string | null {
  const share = recognizeTentacleShare(link);
  if (!share) return null;
  const base = share.url.slice(0, share.url.length - TENTACLE_SHARE_PATH.length - share.id.length);
  return `${base}${MUSIC_SHARE_ROUTES.document.replace(":token", share.id)}`;
}

export function isShareToken(value: string): boolean {
  return TENTACLE_SHARE_TOKEN.test(value);
}

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function text(value: unknown, max: number = MUSIC_IMPORT_LIMITS.field): string | null {
  if (typeof value !== "string") return null;
  const visible = Array.from(value, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c)).join("");
  const trimmed = visible.normalize("NFC").replace(/\s+/g, " ").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Le document lu d'un AUTRE serveur, revérifié champ par champ ; `null` s'il n'en a pas la forme. */
export function readSharedPlaylist(raw: unknown): SharedMusicPlaylist | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !Array.isArray(r.tracks)) return null;
  const tracks: SharedMusicTrack[] = [];
  for (const item of r.tracks.slice(0, MUSIC_IMPORT_LIMITS.tracks)) {
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const title = text(t.title);
    if (!title) continue;
    const artists = (Array.isArray(t.artists) ? t.artists : []).map((a) => text(a)).filter((a): a is string => a !== null).slice(0, MUSIC_IMPORT_LIMITS.artists);
    const duration = typeof t.durationMs === "number" && Number.isFinite(t.durationMs) && t.durationMs > 0 && t.durationMs < 86_400_000 ? Math.round(t.durationMs) : null;
    const recording = typeof t.recording === "string" && MBID.test(t.recording.toLowerCase()) ? t.recording.toLowerCase() : null;
    tracks.push({ title, artists, album: text(t.album), durationMs: duration, recording });
  }
  const total = typeof r.total === "number" && Number.isInteger(r.total) && r.total >= 0 ? r.total : tracks.length;
  return {
    v: 1,
    name: text(r.name, 200) ?? "",
    description: text(r.description, 2_000),
    ownerName: text(r.ownerName, 100) ?? "",
    total,
    truncated: r.truncated === true || total > tracks.length || r.tracks.length > MUSIC_IMPORT_LIMITS.tracks,
    tracks,
  };
}

/** Les titres partagés, tels que la machine d'import les attend (rang = place dans la playlist). */
export function sharedImportTracks(shared: SharedMusicPlaylist): ImportedTrack[] {
  return shared.tracks.map((t, index) => ({
    index,
    title: t.title,
    artists: t.artists,
    album: t.album,
    durationMs: t.durationMs,
    isrc: null,
    // L'enregistrement MusicBrainz du serveur qui partage : une information, jamais une clé du cœur.
    sourceId: t.recording,
  }));
}
