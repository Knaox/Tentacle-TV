/**
 * Octave — IMPORTER dans une playlist ce que l'import par lien ne sait pas prendre : un ALBUM (de la bibliothèque,
 * ou une sortie importée) et des FICHIERS de l'appareil (envoyés par la chaîne des sorties, `useReleaseImport`).
 * Une playlist NEUVE (« Importer », renommable ensuite) ou une playlist EXISTANTE (à la fin), titres dans l'ordre.
 *
 * Portes : l'album, la musique du serveur ; les fichiers, l'extension qui importe des fichiers ET ajoute un titre
 * hors bibliothèque à une playlist (`releaseSources` ∋ `files`, `playlistAdd`) — sinon rien n'est offert.
 * L'état vit dans le MODULE (comme les deux autres imports) : fermer la boîte ou la feuille laisse travailler.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { MusicAlbum, ReleaseRefusal } from "@tentacle-tv/shared/music";
import { isFromMusicProvider, type MusicProvider } from "../../pluginMusic/musicProvider";
import { addExternalTrackToPlaylist, fetchExternalAlbum } from "../../pluginMusic/musicRequests";
import { musicPendingKey } from "../../pluginMusic/useMusicActions";
import { musicApi } from "../musicApi";
import { musicKeys } from "../musicQueryKeys";
import { externalEntityKey } from "../octave/useMusicEntities";
import type { ReleaseFlowState, ReleaseLocalFile } from "../releases/releaseFlow";
import { useReleaseImport } from "../releases/useReleaseImport";
import { useMusicCapability } from "../useMusicLibrary";
import { albumFillItems, fillPlaylist, type FillItem, type FillPort, type FillResult, type FillTarget } from "./playlistFill";
import { releasePlaylistOrder } from "./releaseOrder";

/** Où vont les titres. `new` : `name` choisi par l'utilisateur, sinon celui de l'album, sinon `fallbackName`. */
export type ImportIntoTarget = { kind: "new"; name: string | null; fallbackName: string } | { kind: "existing"; playlistId: string; name: string };

export type ImportIntoFailure = "empty" | "failed" | "network" | ReleaseRefusal;

export interface ImportIntoState {
  source: "album" | "files";
  /** `files` : l'envoi (l'état de la chaîne des sorties dit où il en est) ; `paused` : coupure, « Reprendre ». */
  phase: "files" | "paused" | "filling" | "done" | "failed";
  /** Le nom connu de ce qui entre (l'album), `null` avant. */
  label: string | null;
  result: FillResult | null;
  failure: ImportIntoFailure | null;
}

let current: ImportIntoState | null = null;
let waiting: { target: ImportIntoTarget; provider: MusicProvider } | null = null;
const listeners = new Set<() => void>();
const set = (next: ImportIntoState | null) => {
  current = next;
  listeners.forEach((l) => l());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => current;
const busy = () => current !== null && (current.phase === "files" || current.phase === "filling");

function portFor(provider: MusicProvider | null): FillPort {
  return {
    create: (name, itemIds) => musicApi.createPlaylist(name, itemIds),
    insert: (playlistId, itemIds, position) => musicApi.insertEntries(playlistId, itemIds, position),
    externalAdd: provider?.music.playlistAdd ? (externalId, playlistId, position) => addExternalTrackToPlaylist(provider, externalId, playlistId, position) : undefined,
  };
}

/** Un album AVEC ses titres : de la bibliothèque (Jellyfin), ou de l'extension qui l'a donné. */
async function albumWithTracks(qc: QueryClient, provider: MusicProvider | null, album: MusicAlbum): Promise<MusicAlbum | null> {
  if (album.jellyfinId && !album.key.startsWith("ext:")) {
    const id = album.jellyfinId;
    return qc.fetchQuery({ queryKey: musicKeys.album(id), queryFn: ({ signal }) => musicApi.album(id, signal), staleTime: 30_000 });
  }
  const ref = album.external;
  if (!ref || !isFromMusicProvider(provider, ref.pluginId)) return null;
  return qc.fetchQuery({ queryKey: externalEntityKey("album", album.key), queryFn: ({ signal }) => fetchExternalAlbum(provider, ref.id, signal), staleTime: 30_000 });
}

async function fill(qc: QueryClient, provider: MusicProvider | null, target: ImportIntoTarget, items: FillItem[], albumName: string | null): Promise<FillResult> {
  const name = target.kind === "existing" ? target.name : target.name?.trim() || albumName || target.fallbackName;
  let into: FillTarget = { kind: "new", name };
  if (target.kind === "existing") {
    const detail = await musicApi.playlist(target.playlistId);
    into = { kind: "existing", playlistId: target.playlistId, name: detail.name, entryCount: detail.entries.length };
  }
  try {
    return await fillPlaylist(portFor(provider), into, items);
  } finally {
    void qc.invalidateQueries({ queryKey: musicKeys.playlists() });
    void qc.invalidateQueries({ queryKey: musicKeys.home() });
    if (target.kind === "existing") void qc.invalidateQueries({ queryKey: musicKeys.playlist(target.playlistId) });
    void qc.invalidateQueries({ queryKey: musicPendingKey(provider?.pluginId ?? null) });
  }
}

function finished(source: ImportIntoState["source"], label: string | null, result: FillResult): ImportIntoState {
  // Rien n'est entré (refus dès le premier titre) : un échec, jamais une playlist vide annoncée « prête ».
  if (result.added === 0) return { source, phase: "failed", label, result, failure: result.refusal ?? "failed" };
  return { source, phase: "done", label, result, failure: null };
}

export interface ImportIntoHandle {
  /** « Un album » s'offre (la musique du serveur). */
  albumAvailable: boolean;
  /** « Fichiers » s'offre (l'extension importe des fichiers et les ajoute à une playlist). */
  filesAvailable: boolean;
  state: ImportIntoState | null;
  /** L'envoi des fichiers (chaîne des sorties), pour la barre et « Reprendre ». */
  release: ReleaseFlowState | null;
  importAlbum: (album: MusicAlbum, target: ImportIntoTarget) => Promise<ImportIntoState | null>;
  /** `albumHint` : le nom d'album des fichiers sans tag (le dossier commun). */
  importFiles: (files: ReleaseLocalFile[], albumHint: string | undefined, target: ImportIntoTarget) => Promise<ImportIntoState | null>;
  resume: () => Promise<ImportIntoState | null>;
  cancel: () => void;
  reset: () => void;
}

/** `chunkLimit` : le plus gros morceau d'envoi de CET appareil (le mobile : 2 Mo). */
export function useImportInto(provider: MusicProvider | null, chunkLimit?: number): ImportIntoHandle {
  const qc = useQueryClient();
  const music = useMusicCapability();
  const release = useReleaseImport(provider, chunkLimit);
  const state = useSyncExternalStore(subscribe, read, read);
  const canExternal = !!provider?.music.playlistAdd;
  const filesAvailable = release.sources.includes("files") && canExternal;

  const importAlbum = useCallback(
    async (album: MusicAlbum, target: ImportIntoTarget): Promise<ImportIntoState | null> => {
      if (busy()) return null;
      set({ source: "album", phase: "filling", label: album.title, result: null, failure: null });
      try {
        const full = await albumWithTracks(qc, provider, album);
        const items = albumFillItems(full?.tracks ?? [], (track) => canExternal && isFromMusicProvider(provider, track.external?.pluginId));
        if (items.length === 0) return set({ source: "album", phase: "failed", label: album.title, result: null, failure: "empty" }), current;
        set(finished("album", album.title, await fill(qc, provider, target, items, album.title)));
      } catch {
        set({ source: "album", phase: "failed", label: album.title, result: null, failure: "network" });
      }
      return current;
    },
    [canExternal, provider, qc],
  );

  /** Les fichiers sont arrivés : leurs titres, dans l'ordre de leurs albums, entrent dans la playlist. */
  const afterRelease = useCallback(
    async (final: ReleaseFlowState | null): Promise<ImportIntoState | null> => {
      const ctx = waiting;
      if (!final || !ctx) return current;
      if (final.phase === "paused") return set({ source: "files", phase: "paused", label: null, result: null, failure: null }), current;
      if (final.phase !== "done" || !final.job) return set({ source: "files", phase: "failed", label: null, result: null, failure: final.refusal ?? "failed" }), current;
      const job = final.job;
      const label = job.albums.length === 1 ? (job.albums[0]?.title ?? null) : null;
      set({ source: "files", phase: "filling", label, result: null, failure: null });
      try {
        const albums = await Promise.all(job.albums.map((a) => albumWithTracks(qc, ctx.provider, a).catch(() => null)));
        const ids = releasePlaylistOrder(job, albums);
        if (ids.length === 0) return set({ source: "files", phase: "failed", label, result: null, failure: "empty" }), current;
        const items: FillItem[] = ids.map((externalId) => ({ kind: "external", externalId }));
        set(finished("files", label, await fill(qc, ctx.provider, ctx.target, items, label)));
      } catch {
        set({ source: "files", phase: "failed", label, result: null, failure: "network" });
      } finally {
        waiting = null;
        release.reset();
      }
      return current;
    },
    [qc, release],
  );

  const { startFiles, resume: resumeRelease } = release;
  const importFiles = useCallback(
    async (files: ReleaseLocalFile[], albumHint: string | undefined, target: ImportIntoTarget): Promise<ImportIntoState | null> => {
      // Un import de sortie en cours (la boîte « Importer une sortie ») tient la chaîne : un à la fois.
      const sending = release.state && release.state.phase !== "done" && release.state.phase !== "failed";
      if (busy() || !provider || sending) return null;
      release.reset();
      waiting = { target, provider };
      set({ source: "files", phase: "files", label: albumHint ?? null, result: null, failure: null });
      return afterRelease(await startFiles(files, albumHint));
    },
    [afterRelease, provider, release, startFiles],
  );

  const resume = useCallback(async () => {
    if (current?.phase !== "paused") return null;
    set({ ...current, phase: "files" });
    return afterRelease(await resumeRelease());
  }, [afterRelease, resumeRelease]);

  const { cancel: cancelRelease } = release;
  const cancel = useCallback(() => {
    if (current?.source === "files" && (current.phase === "files" || current.phase === "paused")) cancelRelease();
    waiting = null;
    set(null);
  }, [cancelRelease]);
  const reset = useCallback(() => {
    if (current && (current.phase === "done" || current.phase === "failed")) set(null);
  }, []);

  return useMemo(
    () => ({ albumAvailable: music, filesAvailable, state, release: state?.source === "files" ? release.state : null, importAlbum, importFiles, resume, cancel, reset }),
    [cancel, filesAvailable, importAlbum, importFiles, music, release.state, reset, resume, state],
  );
}
