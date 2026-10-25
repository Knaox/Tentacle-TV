/**
 * Garder hors ligne la MUSIQUE (Octave, bureau) : la mise en file d'un lot de
 * titres, dans le MÊME moteur que les films (palier v11, `schema.ts`).
 *
 * Un titre gardé est un fichier comme un autre — mêmes tables `files` et
 * `claims`, même file, mêmes relances, même contrôle d'espace — dont la fiche
 * vit dans `music_meta` et dont le média se tire d'un chemin du serveur
 * Tentacle (`files.source_path`) : la bibliothèque (`/api/downloads/…`) ou la
 * route d'une extension (`/api/plugins/<id>/…`). La page dit lequel ; le cœur
 * ne connaît aucune extension.
 *
 * Le refus d'espace est GLOBAL, comme pour une saison (`enqueue.ts`) : un album
 * à moitié gardé n'est pas un album gardé.
 */

import type { DatabaseHandle } from "./adapters";
import { CAPACITY_MARGIN_BYTES, hasCapacity } from "./paths";
import { pendingBytes } from "./queue";
import { claimOrCreateFile, findFile, type DownloadVariant } from "./store";

/** Un titre à garder, tel que la page le décrit. */
export interface MusicKeepItem {
  /** `jf:<id Jellyfin>` ou `ext:<extension>:<identifiant>` (`musicKeys.ts`). */
  trackKey: string;
  origin: "library" | "external";
  /** Chemin du média sur le serveur Tentacle (requête comprise) — jamais une autre origine. */
  sourcePath: string;
  variant: DownloadVariant;
  /** Palier de l'Allégé audio (`a256`), `null` pour l'original. */
  preset: string | null;
  /** Extension du fichier ORIGINAL (`flac`, `mp3`…) ; l'Allégé est toujours un `m4a`. */
  containerExt: string;
  /** Taille EXACTE (original de la bibliothèque) — contrôle d'intégrité final. */
  expectedSize: number | null;
  /** Estimation pour le contrôle d'espace. */
  estimatedSize: number | null;
  title: string;
  artist: string | null;
  album: string | null;
  albumKey: string | null;
  discNumber: number | null;
  trackNumber: number | null;
  durationMs: number | null;
  /** Pochette : un chemin du serveur Tentacle seulement (le jeton n'en sort pas), sinon `null`. */
  artworkPath: string | null;
  /** Le titre tel que l'interface le montre (JSON), pour l'afficher sans réseau. */
  trackJson: string;
}

export interface MusicKeepOutcome {
  accepted: boolean;
  neededBytes: number;
  freeBytes: number;
  fileIds: number[];
}

/** Un `trackJson` démesuré n'est pas un titre : borne de la fiche gardée. */
const MAX_TRACK_JSON = 32 * 1024;
const JELLYFIN_ID = /^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/** Un chemin du serveur : `/api/…`, sans `..`, sans `//`, sans schéma ni hôte. */
const SERVER_PATH = /^\/api\/[A-Za-z0-9_\-./%]+(\?[A-Za-z0-9_\-.=&%]*)?$/;

/**
 * Empreinte de 128 bits d'une chaîne (quatre FNV-1a 32 bits de graines
 * différentes) : l'identifiant DISQUE d'un titre hors bibliothèque, dont
 * l'identifiant d'extension (`ytm:t:…`, `rec:…~rel:…`) n'entre pas dans un nom
 * de fichier. Stable d'une version à l'autre : elle nomme des fichiers.
 */
function digest(value: string): string {
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  return seeds
    .map((seed) => {
      let hash = seed >>> 0;
      for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, "0");
    })
    .join("");
}

/**
 * L'identifiant d'item (dossier, ligne de `files`) d'un titre : l'identifiant
 * Jellyfin pour la bibliothèque, `ext-<empreinte>` hors bibliothèque ; `null`
 * pour une clé qui ne tient pas.
 */
export function musicItemId(trackKey: string): string | null {
  if (trackKey.startsWith("jf:")) {
    const id = trackKey.slice(3);
    return JELLYFIN_ID.test(id) ? id.replace(/-/g, "").toLowerCase() : null;
  }
  if (trackKey.startsWith("ext:") && trackKey.length > 6 && trackKey.length <= 400) return `ext-${digest(trackKey)}`;
  return null;
}

/** Le chemin est-il bien un chemin du serveur Tentacle (le jeton y part) ? */
export function isServerPath(path: string): boolean {
  return path.length <= 600 && SERVER_PATH.test(path) && !path.includes("..") && !path.includes("//");
}

function validExt(value: string): boolean {
  return /^[a-z0-9]{1,5}$/.test(value);
}

/** Valide le lot ; lève avec un code STABLE (`empty-batch`, `invalid-item`), comme `validateBatch`. */
export function validateMusicBatch(items: readonly MusicKeepItem[]): void {
  if (items.length === 0) throw new Error("empty-batch");
  for (const item of items) {
    const ok =
      musicItemId(item.trackKey) !== null &&
      (item.origin === "library") === item.trackKey.startsWith("jf:") &&
      isServerPath(item.sourcePath) &&
      (item.artworkPath === null || isServerPath(item.artworkPath)) &&
      (item.variant === "original" || item.variant === "light") &&
      (item.preset === null || validExt(item.preset)) &&
      validExt(item.containerExt) &&
      item.title.length > 0 &&
      item.trackJson.length <= MAX_TRACK_JSON;
    if (!ok) throw new Error("invalid-item");
  }
}

/** Chemin relatif du média d'un titre — figé : le changer rendrait l'existant invisible. */
export function musicRelPath(itemId: string, item: Pick<MusicKeepItem, "variant" | "preset" | "containerExt">): string {
  if (item.variant === "light") return `media/${itemId}/audio-${item.preset ?? "a256"}.m4a`;
  return `media/${itemId}/audio-original.${item.containerExt}`;
}

function identityOf(itemId: string, item: MusicKeepItem): { itemId: string; mediaSourceId: string; variant: DownloadVariant; preset: string | null } {
  // Un titre n'a qu'une source : son identifiant d'item en tient lieu.
  return { itemId, mediaSourceId: itemId, variant: item.variant, preset: item.variant === "light" ? item.preset : null };
}

function upsertMusicMeta(db: DatabaseHandle, itemId: string, item: MusicKeepItem, nowMs: number): void {
  db.prepare(
    `INSERT INTO music_meta (item_id, track_key, origin, title, artist, album, album_key, disc_number,
                             track_number, duration_ms, artwork_path, track_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET title = excluded.title, artist = excluded.artist, album = excluded.album,
       album_key = excluded.album_key, disc_number = excluded.disc_number, track_number = excluded.track_number,
       duration_ms = excluded.duration_ms, artwork_path = excluded.artwork_path, track_json = excluded.track_json,
       updated_at = excluded.updated_at`,
  ).run(
    itemId,
    item.trackKey,
    item.origin,
    item.title,
    item.artist,
    item.album,
    item.albumKey,
    item.discNumber,
    item.trackNumber,
    item.durationMs,
    item.artworkPath,
    item.trackJson,
    nowMs,
    nowMs,
  );
}

/**
 * Met le lot en file, ou le refuse en bloc faute de place. Un titre déjà gardé
 * (par ce compte ou un autre) ne compte pas : on s'y accroche.
 */
export function enqueueMusicBatch(
  db: DatabaseHandle,
  userId: string,
  items: readonly MusicKeepItem[],
  freeBytes: number,
  nowMs: number,
  margin = CAPACITY_MARGIN_BYTES,
): MusicKeepOutcome {
  validateMusicBatch(items);

  let needed = pendingBytes(db);
  for (const item of items) {
    const existing = findFile(db, identityOf(musicItemId(item.trackKey) as string, item));
    if (existing === null || existing.status === "canceled") needed += item.estimatedSize ?? item.expectedSize ?? 0;
  }
  if (needed > 0 && !hasCapacity(needed, freeBytes, margin)) {
    return { accepted: false, neededBytes: needed, freeBytes, fileIds: [] };
  }

  const fileIds: number[] = [];
  for (const item of items) {
    const itemId = musicItemId(item.trackKey) as string;
    upsertMusicMeta(db, itemId, item, nowMs);
    const outcome = claimOrCreateFile(db, {
      ...identityOf(itemId, item),
      userId,
      relPath: musicRelPath(itemId, item),
      // L'Allégé n'a pas de taille exacte : son estimation donne un total à la barre (comme `enqueue.ts`).
      expectedSize: item.expectedSize ?? (item.variant === "light" ? item.estimatedSize : null),
      autoDeleteAfterWatch: false,
      nowMs,
    });
    // Posé à chaque fois : une adresse d'extension a pu changer depuis le premier essai.
    db.prepare("UPDATE files SET source_path = ? WHERE id = ?").run(item.sourcePath, outcome.fileId);
    fileIds.push(outcome.fileId);
  }
  return { accepted: true, neededBytes: needed, freeBytes, fileIds };
}
