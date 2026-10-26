/**
 * Octave — l'import d'une playlist en crochet React : la porte (capacité
 * `music.playlistImport` : sans elle, `available` est faux et aucune entrée ne
 * s'offre), le déroulé (`runImport`) branché sur le cœur et sur l'extension
 * de CE compte, et l'état à rendre. Fini, les playlists du compte se relisent.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MusicImportSource } from "@tentacle-tv/shared/music";
import { useServerCapability } from "../../hooks/useServerCapabilities";
import { musicPendingKey } from "../../pluginMusic/useMusicActions";
import type { MusicProvider } from "../../pluginMusic/musicProvider";
import { musicKeys } from "../musicQueryKeys";
import { runImport, type ImportFlowState, type ImportPort, type ImportUserInput } from "./importFlow";
import { cancelImportTracks, confideImportTracks, fetchCoreImport, fetchImportTracksProgress, readByExtension, refusalCode, startCoreImport } from "./importRequests";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

/** Les sources que l'extension lit pour ce compte (son `importRead`). */
export function extensionImportSources(provider: MusicProvider | null): readonly MusicImportSource[] {
  return provider?.music.importRead ? (provider.music.importSources ?? []) : [];
}

export function importPortFor(provider: MusicProvider | null): ImportPort {
  const readable = extensionImportSources(provider);
  return {
    startCore: startCoreImport,
    core: fetchCoreImport,
    refusal: refusalCode,
    canRead: (source) => readable.includes(source),
    read: (url, signal) => (provider ? readByExtension(provider, url, signal) : Promise.resolve({ ok: false as const, refusal: "unsupported" as const })),
    canConfide: !!provider?.music.importTracks,
    confide: (request, signal) => (provider ? confideImportTracks(provider, request, signal) : Promise.resolve(null)),
    progress: (operationId, signal) => fetchImportTracksProgress(provider!, operationId, signal),
    cancel: (operationId) => {
      if (provider) void cancelImportTracks(provider, operationId);
    },
    sleep,
    now: () => Date.now(),
  };
}

export interface MusicImportHandle {
  /** Le serveur sait importer (capacité) : sinon, aucune entrée. */
  available: boolean;
  /** Les sources lues par l'extension en plus de celles du cœur (YouTube…). */
  extensionSources: readonly MusicImportSource[];
  /** L'extension prendra-t-elle les titres absents de la bibliothèque ? */
  outsideSupported: boolean;
  state: ImportFlowState | null;
  start: (input: ImportUserInput, name?: string) => Promise<ImportFlowState | null>;
  cancel: () => void;
  reset: () => void;
}

export function useMusicImport(provider: MusicProvider | null): MusicImportHandle {
  const available = useServerCapability("music.playlistImport");
  const qc = useQueryClient();
  const [state, setState] = useState<ImportFlowState | null>(null);
  const controller = useRef<AbortController | null>(null);
  const port = useMemo(() => importPortFor(provider), [provider]);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(
    async (input: ImportUserInput, name?: string) => {
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;
      try {
        const final = await runImport(input, port, (next) => {
          if (!own.signal.aborted) setState(next);
        }, own.signal, name);
        void qc.invalidateQueries({ queryKey: musicKeys.playlists() });
        if (final.summary?.outside) void qc.invalidateQueries({ queryKey: musicPendingKey(provider?.pluginId ?? null) });
        return final;
      } catch {
        return null;
      } finally {
        if (controller.current === own) controller.current = null;
      }
    },
    [port, provider, qc],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState(null);
  }, []);

  return {
    available,
    extensionSources: extensionImportSources(provider),
    outsideSupported: port.canConfide,
    state,
    start,
    cancel,
    reset: cancel,
  };
}
