/**
 * Octave — la porte du cache gardé : au premier montage d'Octave, les pages
 * du compte reviennent dans le cache de requêtes AVANT le premier rendu (au
 * plus `HYDRATE_WAIT_MS` : au-delà, Octave s'ouvre quand même et les pages
 * arrivent dès qu'elles sont lues), puis chaque page finie est gardée.
 * Une seule lecture du disque par identité et par chargement de la page ; au
 * lancement en Octave, elle a eu lieu avant le premier rendu (`octaveCacheBoot`).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useArtworkResolver } from "../../components/Artwork";
import { octaveCacheBackend as currentBackend } from "../../cache/octaveCacheBoot";
import { isOctaveCacheHydrated, octaveCacheHydration as hydrationOf, resetOctaveCacheHydration } from "../../cache/octaveCacheHydration";
import { octaveOwner } from "../../cache/octaveOwner";
import { preconnect, preconnectOrigins, warmArtworkList, warmArtworkWhenIdle } from "./artworkWarm";
import { attachOctaveCache, type OctaveQueryClientLike } from "./octaveCachePersister";
import type { OctaveCacheBackend } from "./octaveCacheStore";

export const HYDRATE_WAIT_MS = 200;

/** Pour les tests. */
export function setOctaveCacheBackendForTests(next: OctaveCacheBackend | null): void {
  resetOctaveCacheHydration(next);
}

/** À qui sont les pages : le serveur et le compte (le profil ouvert compris). Sans compte : rien de gardé. */
export const octaveCacheOwner = octaveOwner;

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

/**
 * La même lecture, lancée AVANT d'entrer (la bascule du mode) et bornée à
 * `HYDRATE_WAIT_MS` : la porte, montée ensuite, rend aussitôt — la page qu'on
 * quitte reste à l'écran pendant l'attente, jamais un écran vide.
 */
export function warmOctaveCache(qc: QueryClient): Promise<void> {
  const owner = octaveCacheOwner();
  if (owner === null) return Promise.resolve();
  const job = hydrationOf(qc as unknown as OctaveQueryClientLike, owner).then(() => undefined);
  return Promise.race([job, new Promise<void>((resolve) => setTimeout(resolve, HYDRATE_WAIT_MS))]);
}

export function OctaveCacheBoundary({ children }: { children: ReactNode }) {
  const qc = useQueryClient() as unknown as OctaveQueryClientLike;
  const owner = useMemo(octaveCacheOwner, []);
  // Lu au moment du préchauffage : le jeton peut changer, le montage ne se rejoue pas pour autant.
  const resolver = useArtworkResolver();
  const resolve = useRef(resolver);
  resolve.current = resolver;
  // Lancement en Octave : `main.tsx` a déjà rendu les pages au cache, la porte s'ouvre au premier rendu.
  const [ready, setReady] = useState(() => owner === null || isOctaveCacheHydrated(owner));

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
