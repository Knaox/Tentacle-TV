/**
 * La façade de la MUSIQUE gardée (Octave) vers le moteur hors ligne du mobile —
 * l'équivalent des commandes `downloads_music_*` du bureau
 * (`ipc/downloadsMusic.ts`), en appels directs : la base et le moteur vivent
 * dans le même processus. Même moteur que les films (mêmes tables, même file,
 * mêmes relances, même contrôle d'espace, mêmes transferts d'arrière-plan) ;
 * chaque chemin de média est revalidé par le cœur (`validateMusicBatch` : un
 * chemin du serveur Tentacle, jamais une autre origine).
 */

import {
  deleteClaim,
  deleteMusicCollection,
  enqueueMusicBatch,
  freeSpace,
  listMusicCollections,
  listMusicForUser,
  localSource,
  musicItemOfKey,
  saveMusicCollection,
  type KeptMusicCollection,
  type KeptMusicTrack,
  type MusicKeepItem,
} from "@tentacle-tv/offline-core";
import type { CollectionInput } from "@tentacle-tv/offline-core/music";
import { clearProgress } from "@tentacle-tv/offline-core/react";
import { localDb } from "./database";
import { OFFLINE_SPACE_MARGIN_BYTES } from "./engineApi";
import { offlineEngine } from "./engineRuntime";
import { localResourceUri } from "./localUri";
import { offlineVolume } from "./volume";

/** Met le lot en file — ou le refuse en bloc faute de place — avec ce qui le retient, puis relance le moteur. */
export function keepMusicOffline(userId: string, items: readonly MusicKeepItem[], collection: CollectionInput | null): { accepted: boolean; neededBytes: number } {
  const engine = offlineEngine();
  const db = localDb();
  const outcome = enqueueMusicBatch(db, userId, items, freeSpace(offlineVolume()), Date.now(), OFFLINE_SPACE_MARGIN_BYTES);
  if (outcome.accepted) {
    if (collection) saveMusicCollection(db, userId, collection, Date.now());
    // « Wi-Fi seulement » en données mobiles : le `pump` refuse, le lot attend le Wi-Fi (comme un film).
    engine.pump();
    engine.notifyChanged();
  }
  return { accepted: outcome.accepted, neededBytes: outcome.neededBytes };
}

/** Ce que CE compte a gardé : les titres et ce qui les retient. */
export function listKeptMusic(userId: string): { tracks: KeptMusicTrack[]; collections: KeptMusicCollection[] } {
  const db = localDb();
  return { tracks: listMusicForUser(db, userId), collections: listMusicCollections(db, userId) };
}

/** Retire ces fichiers (et la collection) ; un fichier partagé avec un autre compte reste à lui. */
export async function removeKeptMusic(userId: string, fileIds: readonly number[], collectionKey: string | null): Promise<void> {
  const engine = offlineEngine();
  const db = localDb();
  for (const fileId of fileIds) {
    // Comme pour un film : un transfert qui écrit encore ferait réapparaître le fichier.
    if (engine.isActive(fileId)) {
      engine.cancel(fileId);
      await engine.waitNotActive(fileId, 5_000);
    }
    deleteClaim(db, offlineVolume(), userId, fileId);
    clearProgress(fileId);
  }
  if (collectionKey) deleteMusicCollection(db, userId, collectionKey);
  engine.notifyChanged();
}

/** La tenue à jour réécrit des collections (titres ajoutés, retirés, remplacés) et en efface (une retenue levée). */
export function saveKeptMusicCollections(userId: string, save: readonly CollectionInput[], remove: readonly string[]): void {
  const db = localDb();
  const now = Date.now();
  for (const collection of save) saveMusicCollection(db, userId, collection, now);
  for (const key of remove) deleteMusicCollection(db, userId, key);
  offlineEngine().notifyChanged();
}

/**
 * L'URI `file://` de la copie gardée de ce titre (sous la clé de la COPIE) par ce compte, revérifiée sur le
 * disque (présente, taille exacte) ; `null` : le serveur, comme si rien n'était gardé.
 */
export function keptMusicFileUri(userId: string, copyTrackKey: string): string | null {
  try {
    const db = localDb();
    const itemId = musicItemOfKey(db, copyTrackKey);
    if (itemId === null) return null;
    return localSource(db, offlineVolume(), userId, itemId, Date.now())?.absolutePath ?? null;
  } catch {
    // Base ou racine indisponible : le serveur reprend.
    return null;
  }
}

/** L'URI d'une ressource gardée à côté d'un titre (sa pochette, `coverRel`) ; `null` si le chemin ne tient pas. */
export function keptMusicResourceUri(rel: string): string | null {
  try {
    return localResourceUri(rel);
  } catch {
    return null;
  }
}
