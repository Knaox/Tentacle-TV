/**
 * Octave — l'import de sorties en crochet React. La porte : l'extension déclare `releases` et au moins une source
 * (`releaseSources`) ; sinon `available` est faux et aucune entrée ne s'offre. L'état vit dans un magasin du
 * MODULE (un import à la fois) : fermer la boîte ou la feuille le laisse continuer, et ce qui l'a lancé retrouve
 * sa fin. Fini, la liste des imports du compte se relit.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReleaseImportJob, ReleaseSource } from "@tentacle-tv/shared/music";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { runReleaseFiles, runReleaseLink, type ReleaseFlowState, type ReleaseLocalFile, type ReleasePort } from "./releaseFlow";
import { cancelReleaseJob, fetchImportedReleases, fetchReleaseJob, fetchReleaseUpload, putReleaseChunk, startFilesImport, startLinkImport } from "./releaseRequests";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

export function releasePortFor(provider: MusicProvider, chunkLimit?: number): ReleasePort {
  return {
    chunkLimit,
    startLink: (url, signal) => startLinkImport(provider, url, signal),
    startFiles: (files, signal) => startFilesImport(provider, files, signal),
    putChunk: (uploadId, offset, body, signal) => putReleaseChunk(provider, uploadId, offset, body, signal),
    uploaded: (uploadId, signal) => fetchReleaseUpload(provider, uploadId, signal),
    job: (jobId, signal) => fetchReleaseJob(provider, jobId, signal),
    sleep,
  };
}

/** Les sources que l'extension déclare pour ce compte ; vide : aucune entrée « Importer ». */
export function releaseSourcesOf(provider: MusicProvider | null): readonly ReleaseSource[] {
  return provider?.music.releases ? (provider.music.releaseSources ?? []) : [];
}

export const importedReleasesKey = (pluginId: string) => ["music", "released", pluginId] as const;



/* ── Le magasin du module : un import à la fois ── */

interface Running {
  provider: MusicProvider;
  files: ReleaseLocalFile[] | null;
  albumHint?: string;
  controller: AbortController;
}

let current: ReleaseFlowState | null = null;
let running: Running | null = null;
const listeners = new Set<() => void>();
const set = (next: ReleaseFlowState | null) => {
  current = next;
  listeners.forEach((l) => l());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => current;

/** L'import en cours ou fini (pour un avis hors de la boîte). */
export const releaseImportState = read;
export const subscribeReleaseImport = subscribe;

export interface ReleaseImportHandle {
  available: boolean;
  sources: readonly ReleaseSource[];
  state: ReleaseFlowState | null;
  startLink: (url: string) => Promise<ReleaseFlowState | null>;
  /** `albumHint` : le nom d'album des fichiers sans tag d'album (le dossier commun, `albumHintOf`). */
  startFiles: (files: ReleaseLocalFile[], albumHint?: string) => Promise<ReleaseFlowState | null>;
  /** Un envoi en pause repart d'où le serveur s'est arrêté. */
  resume: () => Promise<ReleaseFlowState | null>;
  cancel: () => void;
  reset: () => void;
}

/** `chunkLimit` : le plus gros morceau que CET appareil envoie (le mobile : 2 Mo). */
export function useReleaseImport(provider: MusicProvider | null, chunkLimit?: number): ReleaseImportHandle {
  const qc = useQueryClient();
  const state = useSyncExternalStore(subscribe, read, read);
  const sources = useMemo(() => releaseSourcesOf(provider), [provider]);

  const launch = useCallback(
    async (run: (port: ReleasePort, signal: AbortSignal) => Promise<ReleaseFlowState>, files: ReleaseLocalFile[] | null, albumHint?: string) => {
      if (!provider || (running && !running.controller.signal.aborted && current && (current.phase === "sending" || current.phase === "reading" || current.phase === "starting"))) return null;
      const controller = new AbortController();
      running = { provider, files, albumHint, controller };
      try {
        const final = await run(releasePortFor(provider, chunkLimit), controller.signal);
        if (final.phase === "done") {
          void qc.invalidateQueries({ queryKey: importedReleasesKey(provider.pluginId) });
          void qc.invalidateQueries({ queryKey: ["music", "search"] });
        }
        return final;
      } catch {
        // Annulé : l'état a déjà été remis à zéro par `cancel`.
        return null;
      }
    },
    [chunkLimit, provider, qc],
  );

  const startLink = useCallback((url: string) => launch((port, signal) => runReleaseLink(port, url, set, signal), null), [launch]);
  const startFiles = useCallback(
    (files: ReleaseLocalFile[], albumHint?: string) => launch((port, signal) => runReleaseFiles(port, files, set, signal, undefined, albumHint), files, albumHint),
    [launch],
  );
  const resume = useCallback(() => {
    const paused = current;
    const files = running?.files;
    const hint = running?.albumHint;
    if (!paused || paused.phase !== "paused" || !paused.job || !files) return Promise.resolve(null);
    const job: ReleaseImportJob = paused.job;
    return launch((port, signal) => runReleaseFiles(port, files, set, signal, job, hint), files, hint);
  }, [launch]);
  const cancel = useCallback(() => {
    const jobId = current?.job?.jobId;
    const owner = running;
    running?.controller.abort();
    running = null;
    if (jobId && owner) void cancelReleaseJob(owner.provider, jobId);
    set(null);
  }, []);
  const reset = useCallback(() => {
    if (current && (current.phase === "done" || current.phase === "failed")) set(null);
  }, []);

  return { available: sources.length > 0, sources, state, startLink, startFiles, resume, cancel, reset };
}

/** Les albums importés du compte (rangée « Importés ») ; rien sans le point `releases`. */
export function useImportedReleases(provider: MusicProvider | null) {
  const enabled = !!provider?.music.releases;
  return useQuery({
    queryKey: importedReleasesKey(provider?.pluginId ?? "none"),
    queryFn: ({ signal }) => fetchImportedReleases(provider!, signal),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
