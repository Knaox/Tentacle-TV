/**
 * Octave — garder des titres sur cet appareil, et les en retirer : la MÊME suite
 * de gestes sur le bureau et le mobile (`keepActions.test.ts`), sur le moteur
 * commun. Seul le chemin vers le moteur change (IPC de la coquille du bureau,
 * appel direct sur le mobile) : c'est le port.
 *
 * Toujours au nom du COMPTE DE L'APPAREIL (`owner`), jamais d'un profil.
 */

import type { MusicOfflinePlanResponse, MusicTrack } from "@tentacle-tv/shared/music";
import type { MusicKeepItem } from "../core/musicKeep";
import type { KeptMusicCollection, KeptMusicTrack } from "../core/musicLibrary";
import { keepItemsFor, libraryIdsOf, planLibrary, type ExternalKeepPath, type KeepCollection, type KeepOutcome } from "./keepItems";

/** Une collection telle que le moteur l'écrit (sans sa date). */
export type CollectionInput = Omit<KeptMusicCollection, "updatedAt">;

export interface KeepEnginePort {
  /** Le compte de l'appareil, prêt à transférer (identifiants connus) ; `null` : rien ne se garde. */
  owner(): { userId: string } | null;
  fetchPlan(body: { ids: string[] }): Promise<MusicOfflinePlanResponse>;
  enqueue(userId: string, items: MusicKeepItem[], collection: CollectionInput | null): Promise<{ accepted: boolean; neededBytes: number }>;
  remove(userId: string, fileIds: number[], collectionKey: string | null): Promise<void>;
  saveCollections(userId: string, save: CollectionInput[], remove: string[]): Promise<void>;
  /** Relit la liste gardée (le magasin). */
  refresh(): Promise<void>;
}

export interface KeepActions {
  keepTracks(tracks: readonly MusicTrack[], externalPath: ExternalKeepPath | null, collection?: KeepCollection | null): Promise<KeepOutcome>;
  removeKept(kept: readonly KeptMusicTrack[], collectionKey?: string | null): Promise<boolean>;
  removeKeptFiles(fileIds: readonly number[]): Promise<boolean>;
  saveKeptCollections(save: readonly KeptMusicCollection[], remove: readonly string[]): Promise<boolean>;
}

export function createKeepActions(port: KeepEnginePort): KeepActions {
  return {
    /** Garde ces titres sur l'appareil (et la collection, si c'en est une). */
    async keepTracks(tracks, externalPath, collection = null) {
      const owner = port.owner();
      if (!owner) return { kind: "failed" };
      try {
        const ids = libraryIdsOf(tracks);
        const plans = ids.length > 0 ? await planLibrary(ids, port.fetchPlan) : new Map();
        const items = keepItemsFor(tracks, plans, externalPath);
        if (items.length === 0) return { kind: "failed" };
        const input = collection && { ...collection, coverItemId: null, trackKeys: [...collection.trackKeys] };
        const outcome = await port.enqueue(owner.userId, items, input);
        await port.refresh();
        if (!outcome.accepted) return { kind: "noSpace", neededBytes: outcome.neededBytes };
        return { kind: "queued", count: items.length, refused: tracks.length - items.length };
      } catch {
        return { kind: "failed" };
      }
    },

    /** Retire ces titres de l'appareil (et la collection) ; un titre partagé avec un autre compte reste à lui. */
    async removeKept(kept, collectionKey = null) {
      const owner = port.owner();
      if (!owner) return false;
      try {
        await port.remove(owner.userId, kept.map((k) => k.fileId), collectionKey);
        await port.refresh();
        return true;
      } catch {
        return false;
      }
    },

    /** Retire ces fichiers de l'appareil (la tenue à jour : un titre qu'une playlist a perdu, une copie remplacée). */
    async removeKeptFiles(fileIds) {
      const owner = port.owner();
      if (!owner || fileIds.length === 0) return false;
      try {
        await port.remove(owner.userId, [...fileIds], null);
        return true;
      } catch {
        return false;
      }
    },

    /** Réécrit ce qui retient des titres (collections) : la tenue à jour. */
    async saveKeptCollections(save, remove) {
      const owner = port.owner();
      if (!owner || (save.length === 0 && remove.length === 0)) return false;
      try {
        await port.saveCollections(owner.userId, save.map(({ updatedAt: _u, ...c }) => c), [...remove]);
        return true;
      } catch {
        return false;
      }
    },
  };
}
