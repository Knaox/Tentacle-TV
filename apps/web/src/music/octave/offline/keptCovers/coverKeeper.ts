/**
 * Octave — le gardien des jaquettes des playlists gardées (bureau, compte de l'appareil) : il garde la couverture
 * de chaque playlist gardée et les images qu'elle peut montrer, et oublie ce que plus rien ne garde. Sans React
 * (`coverKeeper.test.ts`) ; branché par `useKeptCoverKeeper.ts`, lu par `useKeptCover`.
 *
 * Coût : au repos, rien. Une couverture se prend sur un détail DÉJÀ lu ; elle ne se relit (le détail, une requête)
 * que si elle ne donne plus la jaquette de la liste, une fois par demi-heure au plus. Une image ne se copie qu'une
 * fois, et seulement si aucune pochette gardée n'est la même — deux à la fois.
 */

import type { MusicPlaylist, MusicPlaylistDetail } from "@tentacle-tv/shared/music";
import { coversToRead, imagePlan, keptCoverOf, sameCover, type KeptCover } from "@tentacle-tv/offline-core/music";
import { coverId, imageId, type CoverBackend } from "./coverStore";

export const COVER_REREAD_MS = 30 * 60_000;
const IMAGE_CONCURRENCY = 2;

export interface CoverKeeperDeps {
  backend: CoverBackend;
  readDetail: (playlistId: string) => Promise<MusicPlaylistDetail>;
  fetchImage: (url: string) => Promise<Blob | null>;
  objectUrl: (blob: Blob) => string;
  revoke: (url: string) => void;
  now: () => number;
}

export interface CoverKeeperState {
  covers: ReadonlyMap<string, KeptCover>;
  /** Adresse du serveur → adresse affichable de sa copie. */
  copies: ReadonlyMap<string, string>;
}

export interface CoverSyncInput {
  keptIds: ReadonlySet<string>;
  list: readonly MusicPlaylist[] | null;
  /** Adresse du serveur → pochette gardée d'un titre. */
  local: ReadonlyMap<string, string>;
  online: boolean;
}

export function createCoverKeeper(deps: CoverKeeperDeps) {
  let owner: string | null = null;
  let state: CoverKeeperState = { covers: new Map(), copies: new Map() };
  const blobs = new Map<string, true>();
  const readAt = new Map<string, number>();
  const listeners = new Set<() => void>();
  let loading: Promise<void> | null = null;
  let syncing = false;

  const emit = () => listeners.forEach((l) => l());
  const set = (next: Partial<CoverKeeperState>) => {
    state = { ...state, ...next };
    emit();
  };

  async function load(next: string | null): Promise<void> {
    if (next === owner && loading) return loading;
    owner = next;
    for (const url of state.copies.values()) deps.revoke(url);
    blobs.clear();
    state = { covers: new Map(), copies: new Map() };
    emit();
    if (!next) return;
    loading = deps.backend.load(next).then(({ covers, images }) => {
      if (owner !== next) return;
      const copies = new Map<string, string>();
      for (const image of images) {
        copies.set(image.url, deps.objectUrl(image.blob));
        blobs.set(image.url, true);
      }
      set({ covers: new Map(covers.map((c) => [c.playlistId, { playlistId: c.playlistId, artworkUrl: c.artworkUrl, cover: c.cover, savedAt: c.savedAt }])), copies });
    });
    return loading;
  }

  /** Un détail lu (vue de la playlist, relecture) : sa couverture, si la playlist est gardée. */
  async function noteDetail(detail: MusicPlaylistDetail, keptIds: ReadonlySet<string>): Promise<void> {
    if (!owner || !keptIds.has(detail.jellyfinId)) return;
    const next = keptCoverOf(detail, deps.now());
    if (!next || sameCover(state.covers.get(next.playlistId), next)) return;
    const covers = new Map(state.covers);
    covers.set(next.playlistId, next);
    set({ covers });
    await deps.backend.putCover({ ...next, id: coverId(owner, next.playlistId), owner });
  }

  async function copyImages(urls: string[], forOwner: string): Promise<void> {
    const queue = [...urls];
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const blob = await deps.fetchImage(url).catch(() => null);
        if (!blob || owner !== forOwner || blobs.has(url)) continue;
        blobs.set(url, true);
        await deps.backend.putImage({ id: imageId(forOwner, url), owner: forOwner, url, blob });
        set({ copies: new Map(state.copies).set(url, deps.objectUrl(blob)) });
      }
    };
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, queue.length) }, worker));
  }

  /** Un passage : oublier ce qui n'est plus gardé ; avec du réseau, relire ce qui a changé et copier ce qui manque. */
  async function sync(input: CoverSyncInput): Promise<void> {
    if (!owner || syncing) return;
    await loading;
    const forOwner = owner;
    syncing = true;
    try {
      const gone = [...state.covers.keys()].filter((id) => !input.keptIds.has(id));
      if (gone.length > 0) {
        const covers = new Map(state.covers);
        gone.forEach((id) => covers.delete(id));
        set({ covers });
        await deps.backend.remove("covers", gone.map((id) => coverId(forOwner, id)));
      }
      if (input.online && input.list) {
        const now = deps.now();
        for (const id of coversToRead(input.keptIds, state.covers, input.list, now)) {
          if (now - (readAt.get(id) ?? -Infinity) < COVER_REREAD_MS) continue;
          readAt.set(id, now);
          const detail = await deps.readDetail(id).catch(() => null);
          if (detail) await noteDetail(detail, input.keptIds);
        }
      }
      const plan = imagePlan(state.covers.values(), input.local, new Set(blobs.keys()));
      if (plan.drop.length > 0) {
        const copies = new Map(state.copies);
        for (const url of plan.drop) {
          const shown = copies.get(url);
          if (shown) deps.revoke(shown);
          copies.delete(url);
          blobs.delete(url);
        }
        set({ copies });
        await deps.backend.remove("images", plan.drop.map((url) => imageId(forOwner, url)));
      }
      if (input.online && plan.fetch.length > 0) await copyImages(plan.fetch, forOwner);
    } finally {
      syncing = false;
    }
  }

  return {
    load,
    noteDetail,
    sync,
    state: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type CoverKeeper = ReturnType<typeof createCoverKeeper>;
