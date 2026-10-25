/**
 * Octave — la porte du cache gardé : au premier montage d'Octave, les pages
 * du compte reviennent dans le cache de requêtes AVANT le premier rendu (au
 * plus `HYDRATE_WAIT_MS` : au-delà, Octave s'ouvre quand même et les pages
 * arrivent dès qu'elles sont lues), puis chaque page finie est gardée.
 * Une seule lecture du disque par compte et par chargement de la page.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getBackendBase } from "../../../../lib/backendBase";
import { useArtworkResolver } from "../../components/Artwork";
import { preconnect, preconnectOrigins, warmArtworkList, warmArtworkWhenIdle } from "./artworkWarm";
import { attachOctaveCache, hydrateOctaveCache, type HydrationResult, type OctaveQueryClientLike } from "./octaveCachePersister";
import { indexedDbBackend, type OctaveCacheBackend } from "./octaveCacheStore";

export const HYDRATE_WAIT_MS = 200;

let backend: OctaveCacheBackend | null = null;
const hydrations = new Map<string, Promise<HydrationResult>>();
const settled = new Set<string>();

function currentBackend(): OctaveCacheBackend {
  return (backend ??= indexedDbBackend());
}

/** Pour les tests. */
export function setOctaveCacheBackendForTests(next: OctaveCacheBackend | null): void {
  backend = next;
  hydrations.clear();
  settled.clear();
}

/** À qui sont les pages : le serveur et le compte (le profil ouvert compris). Sans compte : rien de gardé. */
export function octaveCacheOwner(): string | null {
  try {
    const raw = localStorage.getItem("tentacle_user");
    const id = raw ? (JSON.parse(raw) as { Id?: unknown }).Id : null;
    return typeof id === "string" && id ? `${getBackendBase()}|${id}` : null;
  } catch {
    return null;
  }
}

function hydrationOf(qc: OctaveQueryClientLike, owner: string): Promise<HydrationResult> {
  let job = hydrations.get(owner);
  if (!job) {
    job = hydrateOctaveCache(qc, currentBackend(), owner).catch(() => ({ restored: 0, dropped: 0, recent: [], known: [] }));
    job.then(() => settled.add(owner), () => settled.add(owner));
    hydrations.set(owner, job);
  }
  return job;
}

/**
 * La lecture du disque part AU PLUS TÔT (montage d'Octave, pendant que sa disponibilité se vérifie) :
 * la porte, montée ensuite, la trouve souvent déjà finie.
 */
export function useOctaveCacheWarmStart(): void {
  const qc = useQueryClient() as unknown as OctaveQueryClientLike;
  const owner = useMemo(octaveCacheOwner, []);
  useEffect(() => {
    if (owner !== null) void hydrationOf(qc, owner);
  }, [qc, owner]);
}

export function OctaveCacheBoundary({ children }: { children: ReactNode }) {
  const qc = useQueryClient() as unknown as OctaveQueryClientLike;
  const owner = useMemo(octaveCacheOwner, []);
  // Lu au moment du préchauffage : le jeton peut changer, le montage ne se rejoue pas pour autant.
  const resolver = useArtworkResolver();
  const resolve = useRef(resolver);
  resolve.current = resolver;
  const [ready, setReady] = useState(() => owner === null || settled.has(owner));

  useEffect(() => {
    if (owner === null) return;
    let alive = true;
    let detach: (() => void) | null = null;
    const wait = setTimeout(() => alive && setReady(true), HYDRATE_WAIT_MS);
    void hydrationOf(qc, owner).then((result) => {
      if (!alive) return;
      clearTimeout(wait);
      setReady(true);
      detach = attachOctaveCache(qc, currentBackend(), owner, { known: result.known });
      const artwork = warmArtworkList(result.recent).map((url) => resolve.current(url));
      // La connexion aux hôtes des pochettes s'ouvre dès maintenant : la première image n'attend plus sa poignée TLS.
      preconnect(preconnectOrigins(warmArtworkList(result.recent, 60, 12).map((url) => resolve.current(url)), globalThis.location?.origin ?? ""));
      warmArtworkWhenIdle(artwork);
    });
    return () => {
      alive = false;
      clearTimeout(wait);
      detach?.();
    };
  }, [qc, owner]);

  return ready ? <>{children}</> : null;
}
