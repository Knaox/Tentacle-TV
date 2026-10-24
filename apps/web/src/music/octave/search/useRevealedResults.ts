/**
 * Octave — ce que la page Recherche MONTRE d'une recherche validée
 * (`revealModel.ts`) : rien tant que la bibliothèque, la page sûre de
 * l'extension et les premières pochettes (décodées) ne sont pas prêtes, puis
 * tout d'un coup ; l'extension seule plus tard si elle tarde. Une section
 * montrée ne se réordonne plus : les révisions de l'extension ne font
 * qu'ajouter dessous (`settleOrder`, tenue), une rangée montrée garde sa place
 * — et se met à jour sur place (disponibilité, cœur, image).
 * Pendant qu'une NOUVELLE recherche se prépare, la précédente reste affichée.
 */

import { useEffect, useMemo, useState } from "react";
import type { MusicAlbum, MusicArtist, MusicSearchResponse, MusicTrack } from "@tentacle-tv/shared/music";
import { preloadArtwork } from "../components/artworkPreload";
import { useArtworkResolver } from "../components/Artwork";
import { ART_BUDGET_MS, ART_FIRST_CARDS, ART_FIRST_TRACKS, REVEAL_CAP_MS, revealDecision } from "./revealModel";
import { settleOrder } from "./stableOrder";
import { useOctaveSearch } from "./useOctaveSearch";

export interface ShownExternal {
  query: string;
  tracks: MusicTrack[];
  albums: MusicAlbum[];
  artists: MusicArtist[];
  complete: boolean;
}

const sameList = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function artOf(tracks: readonly MusicTrack[], cards: readonly { artworkUrl?: string | null; imageUrl?: string | null }[]): (string | null)[] {
  return [...tracks.slice(0, ART_FIRST_TRACKS).map((t) => t.artworkUrl), ...cards.slice(0, ART_FIRST_CARDS).map((c) => c.artworkUrl ?? c.imageUrl ?? null)];
}

/** Les pochettes de tête d'une section, décodées dans leur budget, dès que `ready`. */
function useArtReady(key: string, ready: boolean, urls: readonly (string | null)[]): boolean {
  const resolve = useArtworkResolver();
  const [done, setDone] = useState<string | null>(null);
  const srcs = useMemo(() => urls.map(resolve).filter((s): s is string => !!s), [urls, resolve]);
  useEffect(() => {
    if (!ready || done === key) return;
    let live = true;
    void preloadArtwork(srcs, ART_BUDGET_MS).then(() => {
      if (live) setDone(key);
    });
    return () => {
      live = false;
    };
  }, [ready, key, srcs, done]);
  return ready && done === key;
}

export function useRevealedResults(query: string) {
  const search = useOctaveSearch(query);
  const { library, libraryReady, external, externalReady } = search;
  const [lateFor, setLateFor] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setLateFor(query), REVEAL_CAP_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const libraryData = library.data;
  const libraryArt = useMemo(() => artOf(libraryData?.tracks ?? [], [...(libraryData?.albums ?? []), ...(libraryData?.artists ?? [])]), [libraryData]);
  const externalArt = useMemo(() => artOf(external.tracks, [...external.albums, ...external.artists]), [external.tracks, external.albums, external.artists]);
  const libraryArtReady = useArtReady(`${query}|library`, libraryReady, libraryArt);
  const externalArtReady = useArtReady(`${query}|external`, externalReady, externalArt);
  const decision = revealDecision({ elapsedMs: lateFor === query ? REVEAL_CAP_MS : 0, libraryReady, externalReady, libraryArtReady, externalArtReady });

  const [lib, setLib] = useState<{ query: string; data: MusicSearchResponse | null } | null>(null);
  const [ext, setExt] = useState<ShownExternal | null>(null);
  // Révélation (état dérivé, posé pendant le rendu) : une seule fois par recherche pour la bibliothèque.
  // Une barre vide ne révèle rien (sinon « aucun résultat pour “” » resterait affiché à la recherche suivante).
  const active = query.trim() !== "";
  if (active && decision.library && lib?.query !== query) setLib({ query, data: libraryData ?? null });
  if (active && decision.external) {
    if (ext?.query !== query) {
      setExt({ query, tracks: external.tracks, albums: external.albums, artists: external.artists, complete: external.complete });
    } else {
      const tracks = settleOrder(ext.tracks, external.tracks, true);
      const albums = settleOrder(ext.albums, external.albums, true);
      const artists = settleOrder(ext.artists, external.artists, true);
      if (!sameList(tracks, ext.tracks) || !sameList(albums, ext.albums) || !sameList(artists, ext.artists) || ext.complete !== external.complete) {
        setExt({ query, tracks, albums, artists, complete: external.complete });
      }
    }
  }

  const libraryShown = query.trim() && lib ? lib : null;
  // L'extension d'une AUTRE recherche ne s'affiche que tant que la bibliothèque montrée est la sienne.
  const externalShown = ext && libraryShown && ext.query === libraryShown.query ? ext : null;
  return {
    library: libraryShown,
    external: externalShown,
    externalAvailable: external.available,
    externalLabel: search.externalLabel,
    /** La recherche validée n'est pas encore montrée (la précédente l'est peut-être). */
    preparing: !!query.trim() && libraryShown?.query !== query,
    /** La bibliothèque est montrée, l'extension pas encore (elle tarde) : sa place est réservée. */
    externalPending: external.available && libraryShown?.query === query && externalShown?.query !== query,
  };
}
