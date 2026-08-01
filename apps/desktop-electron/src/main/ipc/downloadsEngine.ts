/**
 * Commandes du moteur de téléchargement.
 *
 * ⚠️ `downloads_list` est enregistrée EN DERNIER, et c'est délibéré : c'est
 * elle qui fait basculer `supportsDownloads()` côté page. Dès qu'elle répond,
 * toute la section réapparaît et appelle la vingtaine d'autres commandes — qui
 * doivent donc être là avant.
 *
 * Les identifiants de connexion transitent par IPC et restent en mémoire du
 * moteur pour la session. Ils ne sont JAMAIS écrits en base.
 */

import { z } from "zod";
import { downloadsEngine, downloadsRoot } from "../downloadsRuntime";
import { enqueueBatch, type EnqueueItem } from "../downloads/enqueue";
import { backfill } from "../downloads/episodeNumbers";
import { listForUser, setAutoDelete, stateForItem } from "../downloads/listing";
import { freeSpace } from "../downloads/paths";
import { deleteClaim } from "../downloads/store";
import { localDb } from "../localDb";
import { CommandRegistry } from "./registry";

const USER_ID = z.string().min(1).max(128);
const FILE_ID = z.number().int().nonnegative();

const CREDS = z.object({ serverUrl: z.string().min(1), token: z.string().min(1) });
const FILE = z.object({ fileId: FILE_ID });
const USER = z.object({ userId: USER_ID });
const USER_FILE = z.object({ userId: USER_ID, fileId: FILE_ID });
const USER_ITEM = z.object({ userId: USER_ID, itemId: z.string().min(1) });

const AUTO_DELETE = z.object({
  userId: USER_ID,
  fileId: FILE_ID,
  enabled: z.boolean(),
  delayMinutes: z.number().int(),
});

const SUBTITLE = z.object({
  index: z.number().int(),
  format: z.string(),
  langTag: z.string(),
});

/**
 * Un item du lot.
 *
 * Les champs absents deviennent `null` et non `undefined` : `node:sqlite`
 * refuse `undefined` à la liaison, et le compilateur nous le dirait — autant
 * normaliser une fois ici plutôt qu'à chaque usage.
 */
const ITEM = z.object({
  itemId: z.string(),
  mediaSourceId: z.string(),
  variant: z.string(),
  preset: z.string().nullish(),
  containerExt: z.string(),
  expectedSize: z.number().nullish(),
  estimatedSize: z.number().nullish(),
  kind: z.string(),
  seriesId: z.string().nullish(),
  seasonId: z.string().nullish(),
  libraryId: z.string().nullish(),
  runtimeTicks: z.number().nullish(),
  title: z.string().nullish(),
  seriesName: z.string().nullish(),
  indexNumber: z.number().nullish(),
  parentIndexNumber: z.number().nullish(),
  autoDeleteAfterWatch: z.boolean(),
  autoDeleteDelayMinutes: z.number().int().nullish(),
  audioStreamIndex: z.number().nullish(),
  burnSubtitleIndex: z.number().nullish(),
  subtitles: z.array(SUBTITLE).nullish(),
});

const ENQUEUE = z.object({
  userId: USER_ID,
  serverUrl: z.string().min(1),
  token: z.string().min(1),
  items: z.array(ITEM),
});

function normaliser(brut: z.infer<typeof ITEM>): EnqueueItem {
  return {
    itemId: brut.itemId,
    mediaSourceId: brut.mediaSourceId,
    variant: brut.variant,
    preset: brut.preset ?? null,
    containerExt: brut.containerExt,
    expectedSize: brut.expectedSize ?? null,
    estimatedSize: brut.estimatedSize ?? null,
    kind: brut.kind,
    seriesId: brut.seriesId ?? null,
    seasonId: brut.seasonId ?? null,
    libraryId: brut.libraryId ?? null,
    runtimeTicks: brut.runtimeTicks ?? null,
    title: brut.title ?? null,
    seriesName: brut.seriesName ?? null,
    indexNumber: brut.indexNumber ?? null,
    parentIndexNumber: brut.parentIndexNumber ?? null,
    autoDeleteAfterWatch: brut.autoDeleteAfterWatch,
    autoDeleteDelayMinutes: brut.autoDeleteDelayMinutes ?? 0,
    audioStreamIndex: brut.audioStreamIndex ?? null,
    burnSubtitleIndex: brut.burnSubtitleIndex ?? null,
    subtitles: brut.subtitles ?? null,
  };
}

/**
 * Rattrapage des numéros d'épisode : une seule fois par session, à la première
 * liste demandée. Lit les `item.json` du disque, donc opérant même au démarrage
 * cent pour cent hors ligne — contrairement à la réparation, qui exige le
 * réseau.
 */
let rattrapageFait = false;

export function registerDownloadsEngineCommands(registry: CommandRegistry): void {
  registry
    .add("downloads_engine_start", {
      schema: CREDS,
      run: ({ serverUrl, token }) => {
        downloadsEngine().start({ serverUrl, token });
      },
    })
    .add("downloads_enqueue", {
      schema: ENQUEUE,
      run: ({ userId, serverUrl, token, items }) => {
        const engine = downloadsEngine();
        engine.setCreds({ serverUrl, token });
        const outcome = enqueueBatch(
          localDb(),
          userId,
          items.map(normaliser),
          freeSpace(downloadsRoot()),
          Date.now(),
        );
        if (outcome.accepted) {
          engine.notifyChanged();
          engine.pump();
        }
        return outcome;
      },
    })
    .add("downloads_pause", { schema: FILE, run: ({ fileId }) => downloadsEngine().pause(fileId) })
    .add("downloads_resume", { schema: FILE, run: ({ fileId }) => downloadsEngine().resume(fileId) })
    .add("downloads_cancel", { schema: FILE, run: ({ fileId }) => downloadsEngine().cancel(fileId) })
    .add("downloads_delete", {
      schema: USER_FILE,
      run: async ({ userId, fileId }) => {
        const engine = downloadsEngine();
        // Un worker qui écrit encore ferait réapparaître le fichier après sa
        // suppression : on l'annule et on attend sa sortie effective.
        if (engine.isActive(fileId)) {
          engine.cancel(fileId);
          await engine.waitNotActive(fileId, 5_000);
        }
        const outcome = deleteClaim(localDb(), downloadsRoot(), userId, fileId);
        engine.notifyChanged();
        return outcome;
      },
    })
    .add("downloads_state_for_item", {
      schema: USER_ITEM,
      run: ({ userId, itemId }) => stateForItem(localDb(), userId, itemId),
    })
    .add("downloads_set_auto_delete", {
      schema: AUTO_DELETE,
      run: ({ userId, fileId, enabled, delayMinutes }) => {
        setAutoDelete(localDb(), userId, fileId, enabled, delayMinutes, Date.now());
        downloadsEngine().notifyChanged();
      },
    })
    // ⚠️ EN DERNIER — voir l'en-tête de ce fichier.
    .add("downloads_list", {
      schema: USER,
      run: ({ userId }) => {
        const db = localDb();
        if (!rattrapageFait) {
          rattrapageFait = true;
          try {
            backfill(db, downloadsRoot());
          } catch {
            // Racine indisponible : les numéros manqueront, la liste sera là.
          }
        }
        return listForUser(db, userId);
      },
    });
}
