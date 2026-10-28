/**
 * Octave — le branchement du gardien des jaquettes (`coverKeeper.ts`) : un seul par application, monté par la
 * portée hors ligne (`MusicOfflineScope`) pour le compte de l'appareil qui garde de la musique (bureau). Il lit ce
 * qui est DÉJÀ là — les détails de playlists du cache de requêtes, la liste des playlists du rail, la musique
 * gardée — et ne demande au réseau que ce qui manque (`coverPlan.ts`).
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { musicApi, musicKeys, useMusicPlaylists } from "@tentacle-tv/api-client";
import type { MusicPlaylistDetail } from "@tentacle-tv/shared/music";
import { localResourceUrl, useDownloadsRootReady } from "../../../../downloads/localFiles";
import { useConnectivity } from "../../../../offline/useConnectivity";
import { octaveOwner } from "../../cache/octaveOwner";
import { useArtworkResolver } from "../../components/Artwork";
import { sizedArtworkUrl } from "../../components/artworkTone";
import { keptPlaylistId } from "../keptPlaylistArt";
import { useKeptMusic } from "../useKeptMusic";
import type { MusicOfflineSurface } from "../keepRules";
import { createCoverKeeper, type CoverKeeper, type CoverKeeperState } from "./coverKeeper";
import { localCoversByUrl } from "./coverPlan";
import { indexedDbCoverBackend } from "./coverStore";

/** La taille d'une copie : la plus grande case montrée (l'en-tête, une seule pochette, écran Retina). */
export const COVER_COPY_SIZE = 512;
/** Les changements en rafale (une progression de transfert) ne font qu'un passage. */
const SYNC_DELAY_MS = 1_500;

const io = { readDetail: (_id: string): Promise<MusicPlaylistDetail> => Promise.reject(new Error("pas encore branché")), fetchImage: async (_url: string): Promise<Blob | null> => null };

let keeper: CoverKeeper | null = null;
function coverKeeper(): CoverKeeper {
  return (keeper ??= createCoverKeeper({
    backend: indexedDbCoverBackend(),
    readDetail: (id) => io.readDetail(id),
    fetchImage: (url) => io.fetchImage(url),
    objectUrl: (blob) => URL.createObjectURL(blob),
    revoke: (url) => URL.revokeObjectURL(url),
    now: () => Date.now(),
  }));
}

const EMPTY: CoverKeeperState = { covers: new Map(), copies: new Map() };

/** Ce que l'appareil garde des jaquettes (vide hors bureau). */
export function useKeptCoverState(): CoverKeeperState {
  // Créé à la demande : la base ne s'ouvre qu'au premier chargement d'un compte (le gardien, au bureau).
  const k = coverKeeper();
  return useSyncExternalStore(k.subscribe, k.state, () => EMPTY);
}

function isPlaylistDetail(key: readonly unknown[], data: unknown): data is MusicPlaylistDetail {
  const [scope, kind, id] = key;
  return scope === "music" && kind === "playlist" && typeof id === "string" && !!data && typeof data === "object" && "entries" in data;
}

export function useKeptCoverKeeper(surface: MusicOfflineSurface): void {
  const active = surface.library;
  const qc = useQueryClient();
  const kept = useKeptMusic();
  const rootReady = useDownloadsRootReady();
  const online = useConnectivity().state === "online";
  const resolve = useArtworkResolver();
  // La liste du rail (même requête, même cache) : rien de plus au réseau.
  const list = useMusicPlaylists({ enabled: active }).data ?? null;
  const keptIds = useMemo(() => new Set(kept.collections.map((c) => keptPlaylistId(c)).filter((id): id is string => id !== null)), [kept.collections]);
  const live = useRef(keptIds);
  live.current = keptIds;

  useEffect(() => {
    io.readDetail = (id) => qc.fetchQuery({ queryKey: musicKeys.playlist(id), queryFn: ({ signal }) => musicApi.playlist(id, signal), staleTime: 30_000 });
    io.fetchImage = async (url) => {
      const src = resolve(sizedArtworkUrl(url, COVER_COPY_SIZE));
      if (!src) return null;
      const response = await fetch(src);
      const blob = response.ok ? await response.blob() : null;
      return blob && blob.type.startsWith("image/") ? blob : null;
    };
  }, [qc, resolve]);

  useEffect(() => {
    if (!active) return;
    void coverKeeper().load(octaveOwner());
    // Un détail lu (vue de la playlist, tenue à jour par le cache) : sa couverture, sans requête.
    return qc.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      const { queryKey, state } = event.query;
      if (isPlaylistDetail(queryKey, state.data)) void coverKeeper().noteDetail(state.data, live.current);
    });
  }, [active, qc]);

  useEffect(() => {
    if (!active || !kept.loaded) return;
    const local = localCoversByUrl(kept.tracks, rootReady ? localResourceUrl : () => null);
    const timer = setTimeout(() => void coverKeeper().sync({ keptIds, list, local, online }), SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, kept.loaded, kept.tracks, keptIds, list, online, rootReady]);
}
