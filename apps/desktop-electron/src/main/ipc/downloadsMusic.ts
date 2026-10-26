/**
 * Octave — les commandes de la musique gardée hors ligne (capacité
 * `offline.music`), sur le MÊME moteur que les films (`downloadsEngine.ts`) :
 * mettre un lot en file (un titre, un album, une playlist), lister ce que CE
 * compte a gardé, le retirer, et réécrire ce qui le retient (collections : la
 * tenue à jour des playlists gardées). Pause, reprise et annulation d'un transfert sont
 * celles des films (`downloads_pause`…), par identifiant de fichier.
 *
 * Les identifiants de connexion restent en mémoire du moteur, comme pour les
 * films ; tout chemin de média est revalidé par le cœur (`validateMusicBatch` :
 * un chemin du serveur Tentacle, jamais une autre origine).
 */

import { z } from "zod";
import { downloadsEngine, downloadsVolume } from "../downloadsRuntime";
import { enqueueMusicBatch } from "../downloads/core/musicKeep";
import { deleteMusicCollection, listMusicCollections, listMusicForUser, saveMusicCollection } from "../downloads/core/musicLibrary";
import { freeSpace } from "../downloads/core/paths";
import { deleteClaim } from "../downloads/core/store";
import { localDb } from "../localDb";
import { HTTP_URL } from "./httpUrl";
import type { CommandRegistry } from "./registry";

const USER_ID = z.string().min(1).max(128);
const TEXT = z.string().max(1000);
const COUNT = z.number().int().nonnegative();

const ITEM = z.object({
  trackKey: z.string().min(1).max(400),
  origin: z.enum(["library", "external"]),
  sourcePath: z.string().min(1).max(600),
  variant: z.enum(["original", "light"]),
  preset: z.string().max(5).nullable(),
  containerExt: z.string().min(1).max(5),
  expectedSize: COUNT.nullable(),
  estimatedSize: COUNT.nullable(),
  title: z.string().min(1).max(1000),
  artist: TEXT.nullable(),
  album: TEXT.nullable(),
  albumKey: z.string().max(400).nullable(),
  discNumber: z.number().int().nullable(),
  trackNumber: z.number().int().nullable(),
  durationMs: COUNT.nullable(),
  artworkPath: z.string().max(600).nullable(),
  trackJson: z.string().max(32 * 1024),
});

const COLLECTION = z.object({
  key: z.string().min(1).max(500),
  kind: z.enum(["album", "playlist", "track"]),
  title: z.string().min(1).max(1000),
  subtitle: TEXT.nullable(),
  coverItemId: z.string().max(64).nullable(),
  trackKeys: z.array(z.string().max(400)).max(5000),
});

const ENQUEUE = z.object({
  userId: USER_ID,
  serverUrl: HTTP_URL,
  token: z.string().min(1),
  items: z.array(ITEM).max(5000),
  collection: COLLECTION.nullish(),
});

/** La tenue à jour réécrit des collections (titres ajoutés, retirés, remplacés) et en efface (une retenue levée). */
const COLLECTIONS = z.object({
  userId: USER_ID,
  save: z.array(COLLECTION).max(500),
  remove: z.array(z.string().max(500)).max(500),
});

const REMOVE = z.object({
  userId: USER_ID,
  fileIds: z.array(z.number().int().nonnegative()).max(5000),
  collectionKey: z.string().max(500).nullish(),
});

export function registerDownloadsMusicCommands(registry: CommandRegistry): void {
  registry
    .add("downloads_music_enqueue", {
      schema: ENQUEUE,
      run: ({ userId, serverUrl, token, items, collection }) => {
        const engine = downloadsEngine();
        engine.setCreds({ serverUrl, token });
        const db = localDb();
        const outcome = enqueueMusicBatch(db, userId, items, freeSpace(downloadsVolume()), Date.now());
        if (outcome.accepted) {
          if (collection) saveMusicCollection(db, userId, collection, Date.now());
          engine.notifyChanged();
          engine.pump();
        }
        return outcome;
      },
    })
    .add("downloads_music_remove", {
      schema: REMOVE,
      run: async ({ userId, fileIds, collectionKey }) => {
        const engine = downloadsEngine();
        const db = localDb();
        let removed = 0;
        for (const fileId of fileIds) {
          // Comme pour un film : un worker qui écrit encore ferait réapparaître le fichier.
          if (engine.isActive(fileId)) {
            engine.cancel(fileId);
            await engine.waitNotActive(fileId, 5_000);
          }
          if (deleteClaim(db, downloadsVolume(), userId, fileId).fileDeleted) removed += 1;
        }
        if (collectionKey) deleteMusicCollection(db, userId, collectionKey);
        engine.notifyChanged();
        return { removed };
      },
    })
    .add("downloads_music_collections", {
      schema: COLLECTIONS,
      run: ({ userId, save, remove }) => {
        const db = localDb();
        const now = Date.now();
        for (const collection of save) saveMusicCollection(db, userId, collection, now);
        for (const key of remove) deleteMusicCollection(db, userId, key);
        downloadsEngine().notifyChanged();
      },
    })
    .add("downloads_music_list", {
      schema: z.object({ userId: USER_ID }),
      run: ({ userId }) => {
        const db = localDb();
        return { tracks: listMusicForUser(db, userId), collections: listMusicCollections(db, userId) };
      },
    });
}
