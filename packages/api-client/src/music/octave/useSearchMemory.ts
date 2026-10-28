/**
 * Octave — la mémoire de l'appareil, côté crochets : noter la page d'un album
 * ou d'un artiste ouverte (`useRecordMusicVisit`), et l'INSTANTANÉ de la
 * recherche vide (`useSearchHomeSnapshot` : « déjà écouté », albums et
 * artistes consultés). Rien n'apparaît ni ne se réordonne sous les yeux : les
 * écoutes et l'historique de la bibliothèque sont lus UNE fois, à l'arrivée
 * (l'historique seulement s'il est déjà en cache ; sinon il est demandé pour la
 * prochaine fois). Le stockage et le propriétaire (serveur + compte) viennent
 * de l'application.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildListenedCards, buildRecentShelves, readRecentVisitsFrom, readSearchListensFrom, recordVisitTo, visitOf, type OctaveDeviceStore,
} from "@tentacle-tv/shared/octave";
import type { MusicAlbum, MusicArtist, MusicHomeResponse } from "@tentacle-tv/shared/music";
import { musicApi } from "../musicApi";
import { musicKeys } from "../musicQueryKeys";
import { useMusicCapability } from "../useMusicLibrary";

/** Note la page d'un album ou d'un artiste, une fois chargée (`null`, `undefined` : rien à noter encore). */
export function useRecordMusicVisit(
  store: OctaveDeviceStore | null,
  owner: string | null,
  kind: "album" | "artist",
  item: MusicAlbum | MusicArtist | null | undefined,
): void {
  // Une fois par page ouverte : la clé décide, l'objet (rafraîchi par le cache) est lu au moment de noter.
  const latest = useRef(item);
  latest.current = item;
  const key = item?.key;
  useEffect(() => {
    const current = latest.current;
    if (!key || !current || !owner) return;
    const visit = kind === "album" ? visitOf("album", current as MusicAlbum, Date.now()) : visitOf("artist", current as MusicArtist, Date.now());
    recordVisitTo(store, visit, owner);
  }, [kind, key, owner, store]);
}

/** L'instantané d'arrivée de la recherche vide : ce que l'appareil a noté, et l'accueil déjà connu du serveur. */
export function useSearchHomeSnapshot(recents: readonly string[], store: OctaveDeviceStore | null, owner: string | null) {
  const qc = useQueryClient();
  const capable = useMusicCapability();
  const [snapshot] = useState(() => {
    const home = qc.getQueryData<MusicHomeResponse>(musicKeys.home());
    return {
      listens: readSearchListensFrom(store),
      history: home?.recentlyPlayed ?? [],
      shelves: buildRecentShelves(readRecentVisitsFrom(store, owner), home?.forYou),
    };
  });
  useEffect(() => {
    if (!capable || qc.getQueryData(musicKeys.home())) return;
    void qc.prefetchQuery({ queryKey: musicKeys.home(), queryFn: ({ signal }) => musicApi.home(signal), staleTime: 30_000 });
  }, [capable, qc]);
  const cards = useMemo(() => buildListenedCards({ recents, listens: snapshot.listens, history: snapshot.history }), [recents, snapshot]);
  return { cards, shelves: snapshot.shelves };
}
